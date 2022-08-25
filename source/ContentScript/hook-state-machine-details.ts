import {XHookHandler, XHookResponse} from 'xhook';
import {parse as parseArn, build as buildArn} from '@aws-sdk/util-arn-parser';
import {HistoryEventType} from '@aws-sdk/client-sfn';
import {describeLogStreams, getLogEvents} from './cloudwatch';
import {
  describeStateMachine,
  extractExecutionNameFromArn,
  StateMachineType,
} from './step-functions';
import {
  ExpressLogMessage,
  ExecutionsList,
  executionStatusFromLatestEventType,
} from './types';
import {getInjectedRoute} from './ui';

export const hookViewStateMachineDetails: XHookHandler = async (request) => {
  const response: XHookResponse = {
    finalUrl: request.url,
    status: 200,
    statusText: '',
    headers: {
      'Content-Type': 'application/json',
    },
    text: '',
    data: '',
  };

  // Only hook some requests
  if (request.method !== 'POST') return undefined;
  if (!request.url.endsWith('/states/service/statemachines/executions'))
    return undefined;

  const route = getInjectedRoute();
  const stateMachineArn = route.current?.params?.stateMachineArn as string;
  const stateMachineArnParts = parseArn(stateMachineArn);
  const stateMachine = await describeStateMachine(stateMachineArn);

  // Leave STANDARD state machines alone
  if (stateMachine.type !== StateMachineType.EXPRESS) return undefined;
  console.log('REQUEST::VIEW_STATE_MACHINE_DETAILS', request);
  const logGroupArn =
    stateMachine.loggingConfiguration?.destinations?.[0]?.cloudWatchLogsLogGroup
      ?.logGroupArn;

  // Return an empty list if state machine doesn't have logging enabled
  if (!logGroupArn) {
    response.text = '[]';
    response.data = '[]';
    return response;
  }

  const logGroupName = logGroupArn.match(/:log-group:(.+?):.*$/)?.[1] as string;

  // Get executions (CloudWatch log streams in state machine's log group)
  const describeLogStreamsResponse = await describeLogStreams(
    stateMachineArnParts.region,
    {
      logGroupName,
      limit: 20,
      descending: true,
      orderBy: 'LogStreamName',
    }
  );

  // Get very basic execution details (from first event in each log stream)
  const executions = await Promise.all(
    describeLogStreamsResponse.logStreams
      ?.filter((logStream) => logStream.arn?.match(/.*\/[\d-]+\/[a-z0-9]+$/))
      .map(async (logStream) => {
        const logStreamName = logStream.arn?.match(
          /log-stream:(.+?)$/
        )?.[1] as string;

        const getLogEventsResponse = await getLogEvents(
          stateMachineArnParts.region,
          {
            logGroupName,
            logStreamName,
            startTime: logStream.firstEventTimestamp,
            limit: 1,
          }
        );

        if (!getLogEventsResponse.events?.[0]?.message) {
          return {
            logEvents: getLogEventsResponse.events,
          };
        }

        const message = JSON.parse(
          getLogEventsResponse.events[0].message
        ) as ExpressLogMessage;

        return {
          logEvents: getLogEventsResponse.events,
          logStream,
          message,
        };
      }) ?? []
  );

  // Map it all together
  const executionsList: ExecutionsList = {
    nextToken: undefined, // describeLogStreamsResponse.nextToken,

    executions: executions
      .filter(({logEvents, message}) => logEvents && message?.execution_arn)
      .map(({logStream, message}) => {
        const executionArnParts = parseArn(message?.execution_arn as string);
        const executionArnResourceParts = executionArnParts.resource.split(':');
        const executionName = extractExecutionNameFromArn(
          message?.execution_arn as string
        );
        executionArnResourceParts[3] += `+${+(logStream?.firstEventTimestamp as number)}`;
        const enrichedExecutionArn = buildArn({
          ...executionArnParts,
          resource: executionArnResourceParts.join(':'),
        });

        const status = executionStatusFromLatestEventType(
          message?.type as HistoryEventType
        );

        const stopDate =
          status && status !== 'RUNNING'
            ? logStream?.lastEventTimestamp
            : undefined;

        return {
          executionArn: enrichedExecutionArn,
          stateMachineArn,
          name: executionName,
          startDate: logStream?.firstEventTimestamp as number,
          stopDate,
          status,
        };
      }),
  };

  const text = JSON.stringify(executionsList);
  response.text = text;
  response.data = text;

  return response;
};
