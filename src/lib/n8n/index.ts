// n8n Integration Module
// Provides bidirectional webhook communication with n8n workflows

export {
  N8nClient,
  getN8nClient,
  createN8nEvent,
  triggerN8nWorkflow,
  n8nTriggers,
  type N8nClientOptions,
  type N8nTriggerResponse
} from './client';

export {
  validateWebhookPayload,
  handleInboundWebhook,
  logInboundWebhook,
  type InboundEventType,
  type InboundWebhookPayload,
  type WebhookHandlerResult
} from './handlers';
