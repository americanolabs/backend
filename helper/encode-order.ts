import { encodeAbiParameters, parseAbiParameters, pad, type Hex, toHex } from 'viem';

type HexAddress = `0x${string}`;

export function encodeOrderData (order: {
  sender: HexAddress;
  recipient: HexAddress;
  inputToken: bigint;
  outputToken: bigint;
  amountIn: bigint;
  amountOut: bigint;
  senderNonce: bigint;
  originDomain: bigint;
  destinationDomain: bigint;
  destinationSettler: HexAddress;
  fillDeadline: bigint;
  data: any;
}): Hex {
  return encodeAbiParameters(
    parseAbiParameters(
      'address, address, uint256, uint256, uint256, uint256, uint256, uint256, uint256, address, uint256, bytes'
    ),
    [
      order.sender,
      order.recipient,
      order.inputToken,
      order.outputToken,
      order.amountIn,
      order.amountOut,
      order.senderNonce,
      order.originDomain,
      order.destinationDomain,
      order.destinationSettler,
      order.fillDeadline,
      order.data
    ]
  );
}

export function generateRandomBytes32(): HexAddress {
  const randomBytes = new Uint8Array(32);
  crypto.getRandomValues(randomBytes); 
  return toHex(randomBytes) as HexAddress;
}