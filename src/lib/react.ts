import ReactNamespace from 'react/index';
import ReactDomNamespace from 'react-dom';

declare global {
  interface Window {
    React: any,
    ReactDOM: any,
  }
  var window: Window;
}

const React = window.React as typeof ReactNamespace;
const ReactDOM = window.ReactDOM as typeof ReactDomNamespace;

export default React;
export {
  ReactDOM
}
