import express from "express";
import type { Request, Response } from "express";
import { ethers, ZeroAddress } from "ethers";
import { PrismaClient } from "@prisma/client";
import * as dotenv from "dotenv";
import cors from "cors";

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;
const prisma = new PrismaClient();

app.use(cors());
app.use(express.json());

const arbitrumSepoliaRPC = process.env.ARBITRUM_SEPOLIA_RPC_URL || "";
const decafTestnetRPC = process.env.DECAF_TESTNET_RPC_URL || "";
const baseSepoliaRPC = process.env.BASE_SEPOLIA_RPC_URL || "";

import { encodeAbiParameters, parseAbiParameters, type Hex, toHex } from "viem";

export function encodeOrderData(order: {
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
      "(address, address, uint256, uint256, uint256, uint256, uint256, uint256, uint256, address, uint256, (address, uint256)[])"
    ),
    [
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
    ]
  );
}

const MOCK_TOKENS = [
  {
    token: ZeroAddress,
    staking: "0x5B4eFE4627d52D22a37da74Ee480CdC1F7bd15a6",
    nameProject: "RockX",
    chain: "Arbitrum Sepolia",
    rpc: arbitrumSepoliaRPC,
  },
  {
    token: ZeroAddress,
    staking: "0x0c2470065cAD1CdE95062E1203B631C3a06B4f79",
    nameProject: "Camelot",
    chain: "Arbitrum Sepolia",
    rpc: arbitrumSepoliaRPC,
  },
  {
    token: ZeroAddress,
    staking: "0x944c0F40efFd73Fb5Cb02851ce7CcA0e30a61D3D",
    nameProject: "Veda",
    chain: "Decaf Testnet",
    rpc: decafTestnetRPC,
  },
  {
    token: ZeroAddress,
    staking: "0xBcBe5DE4D9F8F9336924eCB90888a775DfB06Eb9",
    nameProject: "Hord",
    chain: "Decaf Testnet",
    rpc: decafTestnetRPC,
  },
  {
    token: ZeroAddress,
    staking: "0x86dD79C7D39b6140c4831821d0f4F8C69e0A1B73",
    nameProject: "Morpho",
    chain: "Base Sepolia",
    rpc: baseSepoliaRPC,
  },
  {
    token: ZeroAddress,
    staking: "0xce953102336f666a0cbAe4B2F7BF72a8dcDC72F5",
    nameProject: "Aave",
    chain: "Base Sepolia",
    rpc: baseSepoliaRPC,
  },
  {
    token: ZeroAddress,
    staking: "0x71109FCe837d72D2c9212A60cC4Bd01437bEA3D6",
    nameProject: "Pendle",
    chain: "Base Sepolia",
    rpc: baseSepoliaRPC,
  },
];

const stakingABI = [
  "function fixedAPY() public view returns (uint8)",
  "function totalAmountStaked() public view returns (uint256)",
];

async function updateStakingData(index: number) {
  try {
    if (index >= MOCK_TOKENS.length) return;

    const { token, staking, chain, nameProject, rpc } = MOCK_TOKENS[index];

    if (!rpc) {
      console.warn(`Missing RPC URL for ${nameProject} on ${chain}`);
      return;
    }

    const provider = new ethers.JsonRpcProvider(rpc);
    const contract = new ethers.Contract(staking, stakingABI, provider);

    const apy = await contract.fixedAPY();
    const totalStaked = await contract.totalAmountStaked();

    const formattedTVL = Number(ethers.formatUnits(totalStaked, 18));
    const formattedAPY = Number(apy);

    await prisma.staking.upsert({
      where: { idProtocol: nameProject + "_" + chain },
      update: {
        tvl: formattedTVL,
        apy: formattedAPY,
        updatedAt: new Date(),
      },
      create: {
        idProtocol: nameProject + "_" + staking,
        addressToken: token,
        addressStaking: staking,
        nameToken: "ETH",
        nameProject,
        chain,
        apy: formattedAPY,
        stablecoin: true,
        categories: ["Staking", "Stablecoin"],
        logo: "https://s2.coinmarketcap.com/static/img/coins/64x64/1027.png",
        tvl: formattedTVL,
      },
    });

    console.log(`Updated staking data for ${nameProject} on ${chain}`);
  } catch (error) {
    console.error(`Error updating staking data for index ${index}:`, error);
  }
}

app.get("/staking", async (req: Request, res: Response) => {
  try {
    const data = await prisma.staking.findMany();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch staking data" });
  }
});

app.get("/staking/protocol/:idProtocol", async (req: Request, res: Response) => {
  try {
    const { idProtocol } = req.params;
    const data = await prisma.staking.findMany({
      where: { idProtocol },
    });

    if (!data.length) {
      res.status(404).json({ error: "Staking data not found" });
    }

    res.json(data);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch staking data" });
  }
});

app.post("/staking/update", async (req: Request, res: Response) => {
  try {
    const updatePromises = MOCK_TOKENS.map((_, index) => updateStakingData(index));

    const results = await Promise.allSettled(updatePromises);

    const failedUpdates = results.filter((res) => res.status === "rejected");
    if (failedUpdates.length > 0) {
      console.warn(`Some updates failed: ${failedUpdates.length}`);
    }

    res.json({ message: "All staking data updated successfully", failedUpdates });
  } catch (error) {
    res.status(500).json({ error: "Failed to update staking data" });
  }
});

app.post("/order", async (req: Request, res: Response) => {
  try {
    const {
      sender,
      recipient,
      inputToken,
      outputToken,
      amountIn,
      amountOut,
      originDomain,
      destinationDomain,
      destinationSettler,
    } = req.body;

    if (!sender || !recipient || !inputToken || !outputToken || !amountIn || !amountOut || !originDomain || !destinationDomain || !destinationSettler) {
      res.status(400).json({ error: "Missing required fields" });
    }

    if (!ethers.isAddress(sender) || !ethers.isAddress(recipient) || !ethers.isAddress(destinationSettler)) {
      res.status(400).json({ error: "Invalid Ethereum address" });
    }

    const now = Date.now();
    const timestampMs = BigInt(now);
    const timestampMsDeadline = BigInt(now + 3600000);
    const timestampSec = BigInt(Math.floor(now / 1000));

    const encoded = encodeOrderData({
      sender,
      recipient,
      inputToken: BigInt(inputToken),
      outputToken: BigInt(outputToken),
      amountIn: BigInt(amountIn),
      amountOut: BigInt(amountOut),
      senderNonce: timestampMsDeadline,
      originDomain: BigInt(originDomain),
      destinationDomain: BigInt(destinationDomain),
      destinationSettler,
      fillDeadline: timestampSec,
      data: [],
    });

    res.json({
      order: {
        fillDeadline: timestampSec.toString(),
        orderDataType: "0x08d75650babf4de09c9273d48ef647876057ed91d4323f8a2e3ebc2cd8a63b5e",
        orderData: encoded
      }
    });
  } catch (error) {
    console.error("Error processing order:", error);
    res.status(400).json({ error: "Invalid request" });
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

export default app;
