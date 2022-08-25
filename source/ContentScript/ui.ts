import * as cache from './cache';

interface IInjectorService {
  get<T>(name: string, caller?: string): T;
}

type StateMachineDetailsTabIds = {
  EXECUTION_TAB_ID: string;
  DEFINITION_TAB_ID: string;
  TAGS_TAB_ID: string;
  LOGGING_TAB_ID: string;
  MONITORING_TAB_ID: string;
};

export interface StateMachineDetailsComponent {
  __update(): void;
  activeTabId: string;
  tabs: {label: string; id: string; content: string}[];
}

export const STEP_FUNCTIONS_ROUTES = {
  // VIEW_STATE_MACHINE_DETAILS: "/statemachines/view/:stateMachineArn*",
  // VIEW_EXECUTION_DETAILS_V2: "/v2/executions/details/:executionArn*",
  VIEW_STATE_MACHINE_DETAILS: /^#\/statemachines\/view\/(.*)$/,
  VIEW_EXECUTION_DETAILS: /^#\/executions\/details\/(.*)$/,
  VIEW_EXECUTION_DETAILS_V2: /^#\/v2\/executions\/details\/(.*)$/,
} as const;

interface Route {
  current?: {
    $$route?: {originalPath?: string};
    params?: {stateMachineArn?: string; executionArn?: string};
  };
}

type FilterFunction = <T>(id: string) => T;

type TranslateFunction = (id: string) => string;

interface TemplateCache {
  get: (id: string) => string;
}

export function getInjector(required: true): IInjectorService;
export function getInjector(required: false): IInjectorService | undefined;
export function getInjector(required: boolean): IInjectorService | undefined {
  return cache.get('injector', () => {
    const scopes = Array.from(document.querySelectorAll('.ng-scope'));
    for (const scope of scopes) {
      const injector = window?.angular?.element(scope)?.injector();
      if (injector?.get !== undefined) {
        return injector;
      }
    }

    if (required) {
      throw new Error('Failed to get Angular injector');
    }

    return undefined;
  });
}

export function isReady(): boolean {
  return !!getInjector(false);
}

export function getInjectedRoute(): Route {
  const injector = getInjector(true);
  return injector.get<Route>('$route');
}

export function getInjectedTemplateCache(): TemplateCache {
  const injector = getInjector(true);
  return injector.get<TemplateCache>('$templateCache');
}

export function getInjectedTranslateFunction(): TranslateFunction {
  const injector = getInjector(true);
  const filter = injector.get<FilterFunction>('$filter');
  return filter<TranslateFunction>('translate');
}

export function getInjectedStateMachineDetailsTabIds(): StateMachineDetailsTabIds {
  const injector = getInjector(true);
  return injector.get<StateMachineDetailsTabIds>(
    'STATE_MACHINE_DETAILS_TAB_IDS'
  );
}

// export function getCurrentRoutePath() {
//   const route = getInjectedRoute();
//   return route.current?.$$route?.originalPath;
// }

export function getCurrentRouteRegExp(hash: string): RegExp | undefined {
  for (const pattern of Object.values(STEP_FUNCTIONS_ROUTES)) {
    if (hash.match(pattern)) return pattern;
  }

  return undefined;
}
