import dns from "node:dns";
import net from "node:net";

// Node's "Happy Eyeballs" connect (autoSelectFamily, on by default since Node 20)
// races the addresses a hostname resolves to and gives each one only 250 ms to
// finish its TCP handshake. That budget is fine on a datacentre link and far too
// small on a long one: api.cloudinary.com sits in AWS us-east-1, where a handshake
// from India measures 310-380 ms. Every attempt gets aborted and the whole connect
// rejects with an AggregateError [ETIMEDOUT] whose own `message` is an empty
// string, so it also logs as a 500 with no explanation.
const CONNECT_ATTEMPT_TIMEOUT_MS = 3000;

/**
 * Tunes outbound connection behaviour for high-latency links. Must run before the
 * first socket is opened, so both entry points (src/server.ts and api/index.ts)
 * call it up front.
 */
export function configureNetwork(): void {
  net.setDefaultAutoSelectFamilyAttemptTimeout(CONNECT_ATTEMPT_TIMEOUT_MS);

  // Resolvers behind NAT64 hand back synthesised IPv6 addresses (64:ff9b::/96)
  // interleaved with the real IPv4 ones. On a host without an IPv6 default route
  // each of those is an instant ENETUNREACH, so try IPv4 first rather than burning
  // attempts on addresses that cannot work.
  dns.setDefaultResultOrder("ipv4first");
}
