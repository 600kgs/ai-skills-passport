// binds btu's passport signing identity to this domain. a verifier trusts the key
// because https on this domain says it's btu's, not because of a bare address.
import { issuerAddresses } from "@passport/core";

export type IssuerDocument = {
  issuer: string;
  domain: string;
  network: "devnet" | "mainnet";
  rpcUrl: string;
  authority: string;
  credential: string;
  schema: string;
};

export async function GET(req: Request) {
  const authority = process.env.AUTHORITY_ADDRESS;
  if (!authority) return Response.json({ error: "issuer not configured" }, { status: 503 });
  const { credential, schema } = await issuerAddresses(authority);
  // browsers read the chain with this one, so it must be a keyless public endpoint
  const rpcUrl = process.env.PUBLIC_SOLANA_RPC_URL ?? "https://api.devnet.solana.com";
  const doc: IssuerDocument = {
    issuer: "Business and Technology University (BTU), hackathon test issuer",
    // the configured public address; behind the proxy req.url only knows the container's own host
    domain: new URL(process.env.PUBLIC_BASE_URL ?? req.url).host,
    network: rpcUrl.includes("devnet") ? "devnet" : "mainnet",
    rpcUrl,
    authority, credential, schema,
  };
  return Response.json(doc, { headers: { "Cache-Control": "public, max-age=300", "Access-Control-Allow-Origin": "*" } });
}
