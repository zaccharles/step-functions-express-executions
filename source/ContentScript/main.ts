import xhook from 'xhook';
import {
  getCurrentRouteRegExp,
  getInjectedStateMachineDetailsTabIds,
  getInjectedTemplateCache,
  getInjectedTranslateFunction,
  isReady,
  StateMachineDetailsComponent,
  STEP_FUNCTIONS_ROUTES,
} from './ui';
import {hookViewStateMachineDetails} from './hook-state-machine-details';
import {hookViewExecutionDetails} from './hook-execution-details';

xhook.before(async (request, callback) => {
  if (!isReady()) return callback();

  const currentRouteRegExp = getCurrentRouteRegExp(window.location.hash);

  try {
    if (
      currentRouteRegExp === STEP_FUNCTIONS_ROUTES.VIEW_STATE_MACHINE_DETAILS
    ) {
      const response = await hookViewStateMachineDetails(request);
      return callback(response);
    }

    if (
      currentRouteRegExp === STEP_FUNCTIONS_ROUTES.VIEW_EXECUTION_DETAILS &&
      window.location.hash.includes(':express:')
    ) {
      window.location.hash = `#/v2${window.location.hash.slice(1)}`;
      const response = await hookViewExecutionDetails(request);
      return callback(response);
    }

    if (
      currentRouteRegExp === STEP_FUNCTIONS_ROUTES.VIEW_EXECUTION_DETAILS_V2
    ) {
      const response = await hookViewExecutionDetails(request);
      return callback(response);
    }
  } catch (error: unknown) {
    console.error(error);

    const message =
      error instanceof Error && 'message' in error
        ? error.message
        : 'Something went wrong';

    callback({
      finalUrl: request.url,
      statusText: '',
      status: 500,
      headers: {
        'Content-Type': 'text/plain',
      },
      text: message,
      data: message,
    });

    return undefined;
  }

  return callback();
});

const tabsCallback: MutationCallback = (mutationList) => {
  for (const mutation of mutationList) {
    if (mutation.type === 'characterData') {
      if (mutation.target.parentElement?.nodeName === 'A') {
        const match = mutation.target.textContent?.match(
          /(.+?) (#[a-z0-9]{7})$/
        );
        if (match) {
          mutation.target.parentElement.innerHTML = `${match[1]} <span style="opacity: 0.5;font-family: monospace;padding-left: 2px;">${match[2]}</span>`;
        }
      }
    }
    if (mutation.type === 'childList') {
      for (const node of Array.from(mutation.addedNodes)) {
        if (
          node.nodeName === 'BUTTON' &&
          node instanceof HTMLElement &&
          node.classList.contains('awsui-button') &&
          node.textContent === 'Stop execution'
        ) {
          node.parentElement?.remove();
          return;
        }
      }
    }
  }
};

const documentCallback: MutationCallback = (mutationList) => {
  for (const mutation of mutationList) {
    if (mutation.type === 'childList') {
      for (const node of Array.from(mutation.addedNodes)) {
        if (node.nodeName === 'AWSUI-TABS' && node instanceof HTMLElement) {
          const currentRouteRegExp = getCurrentRouteRegExp(
            window.location.hash
          );

          // Check that we're on the "view state machine details" route
          if (
            currentRouteRegExp !==
            STEP_FUNCTIONS_ROUTES.VIEW_STATE_MACHINE_DETAILS
          ) {
            return;
          }

          // Attach mutation observer
          const tabsObserver = new MutationObserver(tabsCallback);
          const tabsObserverConfig: MutationObserverInit = {
            attributes: false,
            characterData: true,
            childList: true,
            subtree: true,
          };
          tabsObserver.observe(node, tabsObserverConfig);

          // Check if tab has already been added
          const tabsElement = window.angular.element(node);
          const {component: tabsComponent} = tabsElement[0] as unknown as {
            component: StateMachineDetailsComponent;
          };
          const executionTabId =
            getInjectedStateMachineDetailsTabIds().EXECUTION_TAB_ID;
          if (tabsComponent.tabs.some((tab) => tab.id === executionTabId)) {
            return;
          }

          // Add executions tab
          const templateCache = getInjectedTemplateCache();
          const translate = getInjectedTranslateFunction();

          tabsComponent.tabs.splice(1, 0, {
            label: translate('EXECUTIONS'),
            id: executionTabId,
            content: templateCache.get(
              '/js/state-machines/details/state-machine-details-execution-table.html'
            ),
          });

          // Force tabs component to re-render
          // tabsComponent.activeTabId = executionTabId;
          tabsComponent.__update();
        }
      }
    }
  }
};

const documentObserver = new MutationObserver(documentCallback);
const documentObserverConfig: MutationObserverInit = {
  attributes: false,
  childList: true,
  subtree: true,
};
documentObserver.observe(document, documentObserverConfig);

export {};
