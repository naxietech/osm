import { NotFoundException, ParseUUIDPipe } from '@nestjs/common';

/**
 * Validate an `:id` path parameter as a UUID, answering **404** when it isn't one.
 *
 * Every id column in this schema is `uuid`, so an id of the wrong shape can never match a
 * row — it makes Postgres reject the query itself ("invalid input syntax for type uuid"),
 * which the global filter turns into a 500 claiming the server is broken. It also writes a
 * stack trace for a request that was never a server fault, which is how genuine 500s end up
 * buried.
 *
 * 404 rather than the pipe's default 400: a malformed id and an unknown one then look
 * identical from outside, so a caller learns nothing about the shape of our ids.
 *
 * @example
 * ```ts
 * setStatus(@Param('id', uuidParam('User')) id: string) { … }
 * ```
 */
export function uuidParam(entity: string): ParseUUIDPipe {
  return new ParseUUIDPipe({
    exceptionFactory: () => new NotFoundException(`${entity} not found`),
  });
}
