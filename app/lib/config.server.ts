/**
 * Clowder configuration helpers.
 * Reads from environment variables with validation.
 */

export function getTypeheadFlowId(): string {
  const id = process.env.CLOWDER_TYPEHEAD_FLOW_ID;
  if (!id) {
    console.warn("CLOWDER_TYPEHEAD_FLOW_ID not set — typehead flow disabled");
    return "";
  }
  return id;
}

export function isTypeheadEnabled(): boolean {
  return !!process.env.CLOWDER_TYPEHEAD_FLOW_ID;
}
