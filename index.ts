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

const arbitrumSepoliaRPC = process.env.ARBITRUM_SEPOLIA_RPC_URL;
const decafTestnetRPC = process.env.DECAF_TESTNET_RPC_URL;

const MOCK_TOKENS = [
  {
    token: ZeroAddress,
    staking: "0x5B4eFE4627d52D22a37da74Ee480CdC1F7bd15a6",
    nameProject: "RockX",
    chain: "Arbitrum Sepolia",
    rpc: arbitrumSepoliaRPC
  },
  {
    token: ZeroAddress,
    staking: "0x0c2470065cAD1CdE95062E1203B631C3a06B4f79",
    nameProject: "Camelot",
    chain: "Arbitrum Sepolia",
    rpc: arbitrumSepoliaRPC
  },
  {
    token: ZeroAddress,
    staking: "0x944c0F40efFd73Fb5Cb02851ce7CcA0e30a61D3D",
    nameProject: "Veda",
    chain: "Decaf Testnet",
    rpc: decafTestnetRPC
  },
  {
    token: ZeroAddress,
    staking: "0xBcBe5DE4D9F8F9336924eCB90888a775DfB06Eb9",
    nameProject: "Hord",
    chain: "Decaf Testnet",
    rpc: decafTestnetRPC
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

const getStakingData = async (req: Request, res: Response) => {
  try {
    const data = await prisma.staking.findMany();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch staking data" });
  }
};

const getStakingByIdProtocol = async (req: Request, res: Response): Promise<void> => {
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
};

const getStakingByAddress = async (req: Request, res: Response): Promise<void> => {
  try {
    const { address } = req.params;
    const data = await prisma.staking.findUnique({
      where: { addressStaking: address },
    });

    if (!data) {
      res.status(404).json({ error: "Staking data not found" });
      return;
    }

    res.json(data);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch staking data" });
  }
};

const updateStaking = async (req: Request, res: Response) => {
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
};

app.get("/staking", getStakingData);
app.get("/staking/protocol/:idProtocol", getStakingByIdProtocol);
app.get("/staking/address/:address", getStakingByAddress);
app.post("/staking/update", updateStaking);

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

export default app;
