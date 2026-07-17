import express, {
  type NextFunction,
  type Request,
  type Response,
} from "express";
import cors from "cors";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { prisma } from "./db";
import { CreateUserSchema } from "./types";

const app = express();
const PORT = Number(process.env.PORT ?? 3000);
const JWT_SECRET = process.env.JWT_SECRET;

const avatarImageSchema = z.object({
  type: z.enum(["User", "Model"]),
  url: z.string().url(),
});

const createAvatarSchema = z.object({
  name: z.string().trim().min(1).max(120),
  images: z.array(avatarImageSchema).min(1).max(10),
});

const createVideoSchema = z.object({
  prompt: z.string().trim().min(1).max(2_000),
  avatarIds: z.array(z.string().uuid()).min(1).max(3),
  startFrame: z.string().url().optional(),
  endFrame: z.string().url().optional(),
  duration: z.number().int().min(1).max(60).default(8),
  width: z.number().int().min(1).max(7_680).default(1_280),
  height: z.number().int().min(1).max(7_680).default(720),
});

type AuthenticatedRequest = Request & { userId?: string };

app.use(cors());
app.use(express.json());

function authenticate(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) {
  if (!JWT_SECRET) {
    return res.status(500).json({ message: "JWT_SECRET is not configured" });
  }

  const token = req.header("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) {
    return res.status(401).json({ message: "Authentication required" });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    if (
      typeof payload !== "object" ||
      !payload ||
      typeof payload.id !== "string"
    ) {
      return res.status(401).json({ message: "Invalid token" });
    }
    req.userId = payload.id;
    next();
  } catch {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
}

app.post("/api/v1/signup", async (req, res) => {
  const parsed = CreateUserSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid username or password" });
  }

  const existingUser = await prisma.user.findUnique({
    where: { username: parsed.data.username },
    select: { id: true },
  });
  if (existingUser) {
    return res.status(409).json({ message: "Username is already in use" });
  }

  const password = await bcrypt.hash(parsed.data.password, 12);
  const user = await prisma.user.create({
    data: { username: parsed.data.username, password },
    select: { id: true, username: true },
  });
  return res.status(201).json({ user });
});

app.post("/api/v1/signin", async (req, res) => {
  const parsed = CreateUserSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid username or password" });
  }
  if (!JWT_SECRET) {
    return res.status(500).json({ message: "JWT_SECRET is not configured" });
  }

  const user = await prisma.user.findUnique({
    where: { username: parsed.data.username },
  });
  if (!user || !(await bcrypt.compare(parsed.data.password, user.password))) {
    return res.status(403).json({ message: "Invalid username or password" });
  }

  const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, {
    expiresIn: "7d",
  });
  return res.json({ message: "Signin successful", token });
});

app.post(
  "/api/v1/avatar",
  authenticate,
  async (req: AuthenticatedRequest, res) => {
  const parsed = createAvatarSchema.safeParse(req.body);
  if (!parsed.success) {
      return res
        .status(400)
        .json({ message: "Invalid avatar data", errors: parsed.error.flatten() });
  }

    const avatar = await prisma.avatar.create({
    data: {
      userId: req.userId!,
      name: parsed.data.name,
      avatarImage: { create: parsed.data.images },
    },
    include: { avatarImage: true },
    });
    return res.status(201).json({ avatar });
  },
);

app.get(
  "/api/v1/avatar/:avatarId",
  authenticate,
  async (req: AuthenticatedRequest, res) => {
  const avatarId = z.string().uuid().safeParse(req.params.avatarId);
  if (!avatarId.success) {
    return res.status(400).json({ message: "Invalid avatar id" });
  }
    const avatar = await prisma.avatar.findFirst({
    where: { id: avatarId.data, userId: req.userId! },
    include: { avatarImage: true },
    });
    if (!avatar) {
      return res.status(404).json({ message: "Avatar not found" });
    }
    return res.json({ avatar });
  },
);

app.get(
  "/api/v1/avatars",
  authenticate,
  async (req: AuthenticatedRequest, res) => {
  const avatars = await prisma.avatar.findMany({
    where: { userId: req.userId! },
    include: { avatarImage: true },
    orderBy: { id: "desc" },
    });
    return res.json({ avatars });
  },
);

app.post(
  "/api/v1/video",
  authenticate,
  async (req: AuthenticatedRequest, res) => {
  const parsed = createVideoSchema.safeParse(req.body);
  if (!parsed.success) {
      return res
        .status(400)
        .json({ message: "Invalid video data", errors: parsed.error.flatten() });
  }

    const avatars = await prisma.avatar.findMany({
    where: { id: { in: parsed.data.avatarIds }, userId: req.userId! },
    select: { id: true },
    });
    if (avatars.length !== new Set(parsed.data.avatarIds).size) {
      return res.status(400).json({
        message: "One or more avatars do not exist or are not yours",
      });
    }

    const video = await prisma.avatarVideo.create({
    data: {
      userId: req.userId!,
      prompt: parsed.data.prompt,
      startFrame: parsed.data.startFrame,
      endFrame: parsed.data.endFrame,
      duration: parsed.data.duration,
      width: parsed.data.width,
      height: parsed.data.height,
      status: "Pending",
        avatarVideoReference: {
          create: avatars.map((avatar) => ({ avatarId: avatar.id })),
        },
    },
      include: {
        avatarVideoReference: {
          include: { avatar: { include: { avatarImage: true } } },
        },
      },
    });
    return res.status(201).json({ video });
  },
);

app.get("/api/v1/video/:videoId", authenticate, async (req: AuthenticatedRequest, res) => {
  const videoId = z.string().uuid().safeParse(req.params.videoId);
  if (!videoId.success) {
    return res.status(400).json({ message: "Invalid video id" });
  }
  const video = await prisma.avatarVideo.findFirst({
    where: { id: videoId.data, userId: req.userId! },
    include: { avatarVideoReference: { include: { avatar: { include: { avatarImage: true } } } } },
  });
  if (!video) {
    return res.status(404).json({ message: "Video not found" });
  }
  return res.json({ video });
});

app.get("/api/v1/videos", authenticate, async (req: AuthenticatedRequest, res) => {
  const videos = await prisma.avatarVideo.findMany({
    where: { userId: req.userId! },
    include: { avatarVideoReference: { include: { avatar: { include: { avatarImage: true } } } } },
    orderBy: { id: "desc" },
  });
  return res.json({ videos });
});

app.get("/api/v1/me", authenticate, async (req: AuthenticatedRequest, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.userId! },
    select: { id: true, username: true },
  });
  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }
  return res.json({ user });
});

app.get("/api/v1/models", (_req, res) => {
  return res.json({
    models: [
      { id: "google/veo-3.1", name: "Veo 3.1", durations: [8], supportsAudio: false },
    ],
  });
});

app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error(error);
  return res.status(500).json({ message: "Internal server error" });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
