import * as angular from 'angular';

declare global {
  interface Window {
    account: string;
    region: string;
    angular: angular.IAngularStatic;
    location: {
      hash: string;
    };
  }
}
