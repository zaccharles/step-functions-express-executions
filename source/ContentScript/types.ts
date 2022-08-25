import {HistoryEventType} from '@aws-sdk/client-sfn';

export interface GetExecutionDetailsResponse {
  executionArn: string;
  stateMachineArn: string;
  name: string;
  status: ExecutionStatus | undefined;
  startDate: number;
  stopDate: number | undefined;
  input: string | null;
  inputDetails: null | {
    included: boolean;
  };
  output: string | null;
  outputDetails: null | {
    included: boolean;
  };
  traceHeader: string | null;
}

export interface GetDetailsForExecutionResponse {
  stateMachineArn: string;
  name: string;
  definition: string;
  roleArn: string;
  updateDate: number;
  loggingConfiguration: null | {
    // todo
    level: 'OFF';
    includeExecutionData: false;
    destinations: null;
  };
  tracingConfiguration: null | {
    // todo
    enabled: false;
  };
}

export interface ExpressLogMessage {
  id: string;
  type: HistoryEventType;
  details: Record<string, string>;
  previous_event_id: string;
  event_timestamp: string;
  execution_arn: string;
}

export type ExecutionStatus =
  | 'FAILED'
  | 'SUCCEEDED'
  | 'RUNNING'
  | 'ABORTED'
  | 'TIMED_OUT';

export interface ExecutionsList {
  executions: {
    executionArn: string;
    stateMachineArn: string;
    name: string;
    status?: ExecutionStatus;
    startDate: number;
    stopDate?: number;
  }[];
  nextToken: string | undefined;
}

export function executionStatusFromLatestEventType(
  latestEventType: HistoryEventType | ''
): ExecutionStatus | undefined {
  switch (latestEventType) {
    case '':
      return undefined;
    case 'ExecutionAborted':
      return 'ABORTED';
    case 'ExecutionFailed':
      return 'FAILED';
    case 'ExecutionSucceeded':
      return 'SUCCEEDED';
    case 'ExecutionTimedOut':
      return 'TIMED_OUT';
    default:
      return 'RUNNING';
  }
}
