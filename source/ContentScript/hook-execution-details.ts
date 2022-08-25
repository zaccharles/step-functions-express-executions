import {XHookHandler, XHookResponse} from 'xhook';
import {parse as parseArn, build as buildArn} from '@aws-sdk/util-arn-parser';
import {
  DescribeExecutionOutput,
  DescribeStateMachineCommandOutput,
  DescribeStateMachineForExecutionOutput,
  GetExecutionHistoryInput,
  GetExecutionHistoryOutput,
  HistoryEvent,
} from '@aws-sdk/client-sfn';
import {
  describeStateMachine,
  extractExecutionNameFromArn,
  getLogStreamNameForExecution,
  makeStartAndEndTimeFromGuide,
  StateMachineType,
} from './step-functions';
import {STEP_FUNCTIONS_ROUTES} from './ui';
import {getLogEvents} from './cloudwatch';
import {ExpressLogMessage} from './types';

function describeExecution(
  executionArn: string,
  executionName: string,
  stateMachine: DescribeStateMachineCommandOutput
): DescribeExecutionOutput {
  return {
    executionArn,
    name: executionName,
    stateMachineArn: stateMachine.stateMachineArn,
    status: undefined,
    startDate: undefined,
  };
}

function describeStateMachineForExecution(
  stateMachine: DescribeStateMachineCommandOutput
): DescribeStateMachineForExecutionOutput {
  return {
    definition: stateMachine.definition,
    // loggingConfiguration: stateMachine.loggingConfiguration,
    name: stateMachine.name,
    roleArn: stateMachine.roleArn,
    stateMachineArn: stateMachine.stateMachineArn,
    tracingConfiguration: stateMachine.tracingConfiguration,
    updateDate: stateMachine.creationDate, // wtf?
  };
}

function normalizeMessageType(type: string): string {
  if (type.endsWith('StateEntered')) {
    return 'StateEntered';
  }

  if (type.endsWith('StateExited')) {
    return 'StateExited';
  }

  return type;
}

async function getExecutionHistory(
  executionArn: string,
  stateMachine: DescribeStateMachineCommandOutput,
  guideTimestamp: number | undefined,
  nextToken: string | undefined,
  oldestFirst: boolean | undefined,
  maxResults: number | undefined
): Promise<GetExecutionHistoryOutput> {
  const logGroupArn =
    stateMachine.loggingConfiguration?.destinations?.[0]?.cloudWatchLogsLogGroup
      ?.logGroupArn;
  if (!logGroupArn) return {events: []};

  const logGroupName = logGroupArn.match(/:log-group:(.+?):.*$/)?.[1] as string;

  const timeGuide = makeStartAndEndTimeFromGuide(guideTimestamp);
  const logStreamName = await getLogStreamNameForExecution(
    executionArn,
    logGroupName,
    timeGuide.startTime,
    timeGuide.endTime
  );
  if (!logStreamName) return {events: []};

  const executionArnParts = parseArn(executionArn);
  const getLogEventsOutput = await getLogEvents(executionArnParts.region, {
    logGroupName,
    logStreamName,
    nextToken,
    limit: maxResults,
    startFromHead: oldestFirst,
  });

  return {
    events: (getLogEventsOutput.events ?? [])
      .filter((event) => event.message)
      .map((event) => JSON.parse(event.message as string) as ExpressLogMessage)
      .map<HistoryEvent>((message) => {
        const messageType = normalizeMessageType(message.type);
        const detailsPropertyName = `${
          messageType[0].toLowerCase() + messageType.slice(1)
        }EventDetails`;

        return {
          id: Number.parseInt(message.id),
          timestamp: Number.parseInt(
            message.event_timestamp
          ) as unknown as Date,
          type: message.type,
          [detailsPropertyName]: message.details,
          previousEventId: Number.parseInt(message.previous_event_id),
        };
      }),
  };
}

export const hookViewExecutionDetails: XHookHandler = async (request) => {
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
  if (
    !request.url.endsWith('/states/service/statemachines/executions/details') &&
    !request.url.endsWith(
      '/states/service/statemachines/detailsforexecution'
    ) &&
    !request.url.endsWith('/states/service/statemachines/executions/history')
  ) {
    return undefined;
  }

  let guideTimestamp: number | undefined;
  let executionArn = window.location.hash.match(
    STEP_FUNCTIONS_ROUTES.VIEW_EXECUTION_DETAILS_V2
  )?.[1] as string;

  // Separate timestamp guide if present
  const guideTimestampMatch = executionArn.match(/^(.+?)\+(\d{10}|\d{13})$/);
  if (guideTimestampMatch) {
    executionArn = guideTimestampMatch[1] as string;
    guideTimestamp = Number.parseInt(
      guideTimestampMatch[2].length === 10
        ? `${guideTimestampMatch[2]}000`
        : guideTimestampMatch[2]
    );
  }

  // Leave STANDARD state machines alone
  if (!executionArn.includes(':express:')) return undefined;

  const executionArnParts = parseArn(executionArn);
  const executionArnResourceParts = executionArnParts.resource.split(':');
  const executionName = extractExecutionNameFromArn(executionArn);
  const stateMachineName = executionArnResourceParts[1];
  const stateMachineArn = buildArn({
    ...executionArnParts,
    resource: `stateMachine:${stateMachineName}`,
  });

  // Get state machine details
  const stateMachine = await describeStateMachine(stateMachineArn);

  // Double check it's an EXPRESS state machine
  if (stateMachine.type !== StateMachineType.EXPRESS) return undefined;

  let output: unknown;

  // Route to handler
  console.log('Processing request', request);
  if (
    request.url.endsWith('/states/service/statemachines/executions/details')
  ) {
    output = describeExecution(executionArn, executionName, stateMachine);
  }

  if (
    request.url.endsWith('/states/service/statemachines/detailsforexecution')
  ) {
    output = describeStateMachineForExecution(stateMachine);
  }

  if (
    request.url.endsWith('/states/service/statemachines/executions/history')
  ) {
    const input = JSON.parse(request.body) as GetExecutionHistoryInput;
    output = await getExecutionHistory(
      executionArn,
      stateMachine,
      guideTimestamp,
      input.nextToken,
      !input.reverseOrder,
      input.maxResults
    );
  }

  const text = JSON.stringify(output, null, 2);
  response.text = text;
  response.data = text;

  console.log('Responding to', request, 'with', response);

  return response;
};
