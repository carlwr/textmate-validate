import { readFileSync } from 'node:fs';
import { Ajv } from 'ajv';
import type { ValidateFunction } from 'ajv';
import { describe_for } from '../helpers/describe_for.js';
import * as grammar from './grammar.js';

const TM_SCHEMA = 'test/schemas/tmLanguage.schema.json'

let validator: {
  ajv     : Ajv
  validate: ValidateFunction<unknown>
} | null = null

function check(g: grammar.Grammar) {
  validator = validator ?? ( () => {
    const ajv = new Ajv()
    const validate = ajv.compile(JSON.parse(readFileSync(TM_SCHEMA, 'utf8')))
    return { ajv, validate }
  })()

  if (!validator.validate(g)) {
    throw new Error(validator.ajv.errorsText(validator.validate.errors));
  }
}

describe_for('schema', [
  grammar.simple,
  grammar.deep,
  grammar.withInvalid
], gg => {
  check(gg.grammar);
})()
