import React, { PureComponent } from 'react';
import { Button, IconName } from '@grafana/ui';
import { PanelProps } from '@grafana/data';
import { getTemplateSrv } from '@grafana/runtime';

import { ButtonPanelOptions, ButtonPanelState } from 'types';
import { VariableType } from '@grafana/data/types/templateVars';

interface Props extends PanelProps<ButtonPanelOptions> {}

export class ButtonPanel extends PureComponent<Props, ButtonPanelState> {
  constructor(props: any) {
    super(props);
    this.init();
  }

  init() {
    this.state = {
      api_call: 'READY',
      response: '',
      resolvedVariables: [],
    };
  }

  resolveFilterVariables() {
    const templateSrv = getTemplateSrv();
    const resolvedVariables: Array<{ name: any; value: any; type: VariableType }> = [];
    templateSrv.getVariables().map(variable => {
      if (variable.type === 'adhoc') {
        // @ts-ignore
        variable.filters.map(filter => {
          resolvedVariables.push({
            name: filter.key,
            value: filter.value,
            type: variable.type,
          });
        });
      } else if (variable.type === 'textbox') {
        resolvedVariables.push({
          name: variable.name,
          // @ts-ignore
          value: variable.query,
          type: variable.type,
        });
      }
    });
    return resolvedVariables;
  }

  // @ts-ignore
  replaceVariableValue(variableName) {
    const variable = this.state.resolvedVariables.find(function({ name }) {
      return name === variableName;
    });
    if (variable?.value === undefined) {
      const normalGrafanaVariable = this.props.replaceVariables('$' + variableName);
      if (!(normalGrafanaVariable === '$' + variableName)) {
        return normalGrafanaVariable;
      }
    }
    return variable?.value;
  }

  // @ts-ignore
  replaceVariableInText(text) {
    const regex = /\$\w+/gi;
    const foundMatch = [...text.matchAll(regex)];
    foundMatch?.map(match => {
      const varName = match[0].replace('$', '');
      text = text.replace(match[0], this.replaceVariableValue(varName));
    });
    return text;
  }

  componentDidMount() {
    this.setState({
      resolvedVariables: this.resolveFilterVariables(),
    });
  }

  // @ts-ignore
  componentDidUpdate(previousProps, previousState) {
    const resolvedVariables = this.resolveFilterVariables();
    const condition =
      resolvedVariables.length === previousState.resolvedVariables.length &&
      resolvedVariables.every((value, index) => value.value === previousState.resolvedVariables[index].value);
    if (!condition) {
      this.setState({
        resolvedVariables: resolvedVariables,
      });
    }
  }

  render() {
    const { options } = this.props;

    const exeucte = () => {
      this.setState({ api_call: 'IN_PROGRESS' });
      console.log(options.method?.value, ' to ', options.url, ' with key as ', options.type?.value);

      const url = new URL(options.url);

      const requestHeaders: HeadersInit = new Headers();
      requestHeaders.set('Content-Type', 'application/json');
      requestHeaders.set('Accept', 'application/json');

      const fetchOpts: RequestInit = {
        method: options.method?.value, // *GET, POST, PUT, DELETE, etc.
        mode: 'cors', // no-cors, *cors, same-origin
        cache: 'no-cache', // *default, no-cache, reload, force-cache, only-if-cached
        //credentials: 'same-origin', // include, *same-origin, omit
        headers: requestHeaders,
        redirect: 'follow', // manual, *follow, error
        //referrerPolicy: 'no-referrer', // no-referrer, *no-referrer-when-downgrade, origin, origin-when-cross-origin, same-origin, strict-origin, strict-origin-when-cross-origin, unsafe-url
      };

      if (options.type?.value === 'HEADER') {
        options.params.forEach(e => {
          requestHeaders.set(e[0], e[1]);
        });
        options.variableParams.forEach(e => {
          const value = this.replaceVariableValue(e[1]);
          if (value !== undefined) {
            requestHeaders.set(e[0], value);
          }
        });
      } else if (options.type?.value === 'QUERY') {
        options.params.forEach(e => {
          url.searchParams.append(e[0], e[1]);
        });
        options.variableParams.forEach(e => {
          const value = this.replaceVariableValue(e[1]);
          if (value !== undefined) {
            url.searchParams.append(e[0], value);
          }
        });
      } else {
        console.error('Unknown api key type', options.type);
      }

      fetch(url.toString(), fetchOpts)
        .then(response => {
          if (response.ok) {
            this.setState({
              api_call: 'SUCCESS',
              response: response.statusText,
              resolvedVariables: this.resolveFilterVariables(),
            });
            console.log('Requeste successful: ', response);
          } else {
            console.log('Requeste failed: ', response);
            throw new Error(response.status + response.statusText);
          }
        })
        .catch(e => {
          this.setState({
            api_call: 'ERROR',
            response: e.message,
            resolvedVariables: this.resolveFilterVariables(),
          });
          console.error('Request error: ', e);
        });
    };

    const apiStateIcon = (): IconName => {
      switch (this.state.api_call) {
        case 'IN_PROGRESS':
          return 'fa fa-spinner';
        case 'SUCCESS':
          return 'check';
        case 'ERROR':
          return 'exclamation-triangle';
        case 'READY':
        default:
          return 'cog';
      }
    };

    const apiStateClassName = () => {
      switch (this.state.api_call) {
        case 'IN_PROGRESS':
          return 'spinning';
        default:
          return '';
      }
    };
    const getOrientation = () => {
      switch (this.props.options.orientation.value) {
        case 'left':
          return 'left';
        case 'right':
          return 'right';
        case 'center':
        default:
          return 'center';
      }
    };

    return (
      <div className={getOrientation()}>
        <Button
          variant={this.props.options.variant?.value}
          title={this.state.response}
          size="lg"
          className={apiStateClassName()}
          icon={apiStateIcon()}
          onClick={exeucte}
        >
          {this.replaceVariableInText(options.text)}
        </Button>
      </div>
    );
  }
}
