import {DescribeStateMachineCommandOutput} from '@aws-sdk/client-sfn';
import {parse as parseArn} from '@aws-sdk/util-arn-parser';
import {getInjector} from './ui';
import * as cache from './cache';
import {filterLogEvents} from './cloudwatch';

interface StateMachinesService {
  describeStateMachine: (
    stateMachineArn: string
  ) => Promise<DescribeStateMachineCommandOutput>;
}

function getStateMachinesService(): StateMachinesService {
  return getInjector(true).get<StateMachinesService>('StateMachinesService');
}

export async function describeStateMachine(
  stateMachineArn: string,
  options?: {skipCache?: boolean}
): Promise<DescribeStateMachineCommandOutput> {
  return cache.get(
    `describeStateMachine-${stateMachineArn}`,
    async () => {
      const stateMachinesService = getStateMachinesService();
      return stateMachinesService.describeStateMachine(stateMachineArn);
    },
    options?.skipCache
  );
}

export async function getLogStreamNameForExecution(
  executionArn: string,
  logGroupName: string,
  startTime?: number,
  endTime?: number
): Promise<string | undefined> {
  const factory = async (): Promise<string | undefined> => {
    const arnParts = parseArn(executionArn);

    let nextToken: string | undefined;

    for (;;) {
      const output = await filterLogEvents(arnParts.region, {
        logGroupName,
        limit: 1,
        filterPattern: `{$.execution_arn="${executionArn}"}`,
        logStreamNamePrefix: 'states/',
        nextToken,
        startTime,
        endTime,
      });

      const logStreamName = output.events?.[0]?.logStreamName;
      if (logStreamName) return logStreamName;

      if (nextToken === output.nextToken) return undefined;
      nextToken = output.nextToken;
    }
  };

  const logStreamName = await cache.get(
    `getLogStreamNameForExecution-${executionArn}-${logGroupName}`,
    factory
  );

  return (
    logStreamName ||
    cache.get(
      `getLogStreamNameForExecution-${executionArn}-${logGroupName}`,
      factory,
      true
    )
  );
}

export enum StateMachineType {
  EXPRESS = 'EXPRESS',
  STANDARD = 'STANDARD',
}

export function makeStartAndEndTimeFromGuide(
  guideTimestamp: number | undefined
): {startTime?: number; endTime?: number} {
  if (!guideTimestamp) return {};

  // Subtract and add 5 minutes (maximum EXPRESS execution time)
  const startTime = guideTimestamp - 360000;
  const endTime = guideTimestamp + 360000;

  return {startTime, endTime};
}

export function extractExecutionNameFromArn(executionArn: string): string {
  const executionArnParts = parseArn(executionArn);
  const executionArnResourceParts = executionArnParts.resource.split(':');

  const userGivenName = executionArnResourceParts.slice(-2)[0];
  const uuidPrefix = executionArnResourceParts.slice(-1)[0].substring(0, 7);

  const executionName = `${userGivenName} #${uuidPrefix}`;

  return executionName;
}
