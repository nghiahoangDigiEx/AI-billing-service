import { LoggerService, Injectable } from '@nestjs/common';
import { loggerConfig } from './logger.config';

@Injectable()
export class AppLoggerService implements LoggerService {
  private context?: string;

  setContext(context: string) {
    this.context = context;
  }

  private isObject(data: unknown): data is Record<string, unknown> {
    return data !== null && typeof data === 'object' && !Array.isArray(data);
  }

  private maskSensitiveData(data: unknown): unknown {
    if (data === null || data === undefined) return data;

    if (Array.isArray(data)) {
      return data.map((item) => this.maskSensitiveData(item));
    }

    if (!this.isObject(data)) return data;

    try {
      const maskedData: Record<string, unknown> = { ...data };
      for (const key of Object.keys(maskedData)) {
        const lowerKey = key.toLowerCase();
        const isSensitive = loggerConfig.sensitiveFields.some((field) =>
          lowerKey.includes(field.toLowerCase()),
        );

        if (isSensitive) {
          maskedData[key] = loggerConfig.maskPlaceholder;
        } else if (
          this.isObject(maskedData[key]) ||
          Array.isArray(maskedData[key])
        ) {
          maskedData[key] = this.maskSensitiveData(maskedData[key]);
        }
      }
      return maskedData;
    } catch {
      return '[Complex/Circular Object]';
    }
  }

  private extractContext(optionalParams: unknown[]): {
    context: string;
    params: unknown[];
  } {
    let context = this.context || 'Application';
    const params = [...optionalParams];

    if (params.length > 0 && typeof params[params.length - 1] === 'string') {
      const possibleContext = params[params.length - 1] as string;
      // Heuristic: context usually doesn't have spaces or is a single word like 'AppModule'
      if (!possibleContext.includes(' ') || possibleContext.length < 30) {
        context = params.pop() as string;
      }
    }

    return { context, params };
  }

  private buildLogStructure(
    level: string,
    message: unknown,
    optionalParams: unknown[],
  ): string {
    const timestamp = new Date().toISOString();
    const { context, params } = this.extractContext(optionalParams);

    let msgObj: Record<string, unknown> = {};
    if (typeof message === 'string') {
      msgObj = { message };
    } else if (this.isObject(message)) {
      msgObj = { ...message };
    } else {
      msgObj = { message };
    }

    const maskedMessage = this.maskSensitiveData(msgObj) as Record<
      string,
      unknown
    >;
    const maskedParams = this.maskSensitiveData(params) as unknown[];

    const logStructure: Record<string, unknown> = {
      timestamp,
      level,
      context,
      ...maskedMessage,
    };

    if (maskedParams && maskedParams.length > 0) {
      logStructure['metadata'] =
        maskedParams.length === 1 ? maskedParams[0] : maskedParams;
    }

    return JSON.stringify(logStructure);
  }

  log(message: unknown, ...optionalParams: unknown[]) {
    console.log(this.buildLogStructure('INFO', message, optionalParams));
  }

  error(message: unknown, ...optionalParams: unknown[]) {
    let stack: string | undefined;
    const modifiedParams = [...optionalParams];

    const stackIndex = modifiedParams.findIndex(
      (p) =>
        typeof p === 'string' &&
        (p.includes('\n    at ') || p.startsWith('Error: ')),
    );
    if (stackIndex !== -1) {
      stack = modifiedParams[stackIndex] as string;
      modifiedParams.splice(stackIndex, 1);
    }

    const logOutput = this.buildLogStructure('ERROR', message, modifiedParams);

    try {
      const logObj = JSON.parse(logOutput) as Record<string, unknown>;
      if (stack) {
        logObj['stack'] = stack;
      }
      console.error(JSON.stringify(logObj));
    } catch {
      console.error(logOutput);
    }
  }

  warn(message: unknown, ...optionalParams: unknown[]) {
    console.warn(this.buildLogStructure('WARN', message, optionalParams));
  }

  debug(message: unknown, ...optionalParams: unknown[]) {
    console.debug(this.buildLogStructure('DEBUG', message, optionalParams));
  }

  verbose(message: unknown, ...optionalParams: unknown[]) {
    console.log(this.buildLogStructure('VERBOSE', message, optionalParams));
  }

  fatal(message: unknown, ...optionalParams: unknown[]) {
    console.error(this.buildLogStructure('FATAL', message, optionalParams));
  }
}
