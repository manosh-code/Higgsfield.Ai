import express from "express";
import { prisma }  from "./db"
import { CreateAvatarSchema, CreateUserSchema} from "./types"
import  {createImage} from "./image"
import { generateVideo} from "./video";
import cors from "cors";
const jwt = require("jsonwebtoken");
import  bcrypt from "bcrypt";
import JWT_SECRET from "./env";

const app = express();
app.use(cors());
app.use(express.json());

// auth
app.post("/api/v1/signup", async (req, res) => {
    const {success, data} = CreateUserSchema.safeParse(req.body);
    if(!success){
        res.status(411).json({
            message: "Incorrect credentials"
        })
        return;
    }

    const user = await prisma.user.create({
        data: {
            username: req.body.username,
            password: req.body.password
        }
    })
    res.json({
        id: user.id
    })
})

app.post("/api/v1/signin", async(req, res) => {
    const { success, data } = CreateUserSchema.safeParse(req.body);

    if(!success){
        return res.status(400).json({
            message: "Invalid input"
        })
    }

    const user = await prisma.user.findUnique({
        where: {
            username: data.username
        }
    });

    if(!user){
        return res.status(403).json({
            message: "Invalid username or password"
        })
    }

    const isPasswordCorrect = await bcrypt.compare(
        data.password,
        user.password
    );

    if(!isPasswordCorrect){
        return res.status(403).json({
            message: "Invalid password"
        })
    }

    const token = jwt.sign({
        id: user.id,
        username: user.username
    }, JWT_SECRET,{
        expriresIn: "7d"
    }
    );

    res.json ({
        message: "Signin successful",
        token
    })
})

app.post("/api/v1/avatar", (req, res) => {
    
})