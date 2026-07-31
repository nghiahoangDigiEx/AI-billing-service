import { applyDecorators, Type } from '@nestjs/common';
import { ApiResponse, ApiExtraModels, getSchemaPath } from '@nestjs/swagger';

export const ApiStandardResponse = (options: {
  status?: number;
  description?: string;
  type?: Type<unknown> | [Type<unknown>];
}) => {
  const isArray = Array.isArray(options.type);
  const type = isArray
    ? (options.type as [Type<unknown>])[0]
    : (options.type as Type<unknown> | undefined);

  const dataSchema = type
    ? isArray
      ? { type: 'array', items: { $ref: getSchemaPath(type) } }
      : { $ref: getSchemaPath(type) }
    : undefined;

  const properties: Record<string, any> = {
    success: { type: 'boolean', example: true },
  };

  if (dataSchema) {
    properties.data = dataSchema;
  }

  const decorators = [
    ApiResponse({
      status: options.status || 200,
      description: options.description,
      schema: {
        type: 'object',
        properties,
      },
    }),
  ];

  if (type) {
    decorators.push(ApiExtraModels(type));
  }

  return applyDecorators(...decorators);
};
