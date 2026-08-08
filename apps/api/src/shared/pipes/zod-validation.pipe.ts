import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import type { ZodType, ZodTypeDef } from 'zod';

/**
 * Input and output are separate type parameters so a schema may `.transform()` — a query string
 * arrives as text and often needs to reach the handler as something else (`'true'` → `true`).
 * `ZodSchema<T>` pins both ends to one type and rejects those schemas at compile time, even
 * though this pipe has always returned the parsed *output* at runtime. For a plain schema the two
 * infer to the same type, so every existing call site is unaffected.
 */
@Injectable()
export class ZodValidationPipe<TOutput, TInput = TOutput> implements PipeTransform {
  constructor(private readonly schema: ZodType<TOutput, ZodTypeDef, TInput>) {}

  transform(value: unknown): TOutput {
    const result = this.schema.safeParse(value);

    if (!result.success) {
      const errors = result.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`);
      throw new BadRequestException(errors.join('; '));
    }

    return result.data;
  }
}
