import { anthropic } from '@ai-sdk/anthropic';

// One place to swap providers: any AI SDK provider model fits here.
export const answerModel = anthropic('claude-sonnet-5-5');
export const fastModel = anthropic('claude-haiku-5-5');
