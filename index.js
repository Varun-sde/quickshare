import express from "express";
import mongoose from "mongoose";
import multer from "multer";
import cors from "cors";
import fs from "fs";
import path from "path";

const app = express();
const storagePath = "./storage";

const getFolderSizeSync = (folderPath) => 
  fs.readdirSync(folderPath).reduce((total, file) => {
    const filePath = path.join(folderPath, file);
    const stats = fs.statSync(filePath);
    return stats.isFile() ? total + stats.size : total + getFolderSizeSync(filePath);
  }, 0);

const deleteFilesInFolder = (folderPath) => 
  fs.readdirSync(folderPath).forEach((file) => fs.unlinkSync(path.join(folderPath, file)));

const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, storagePath),
  filename: (_, file, cb) => cb(null, `file${Date.now()}.${file.originalname.split(".").pop()}`),
});

const upload = multer({ storage });

const FileModel = mongoose.model(
  "files", 
  new mongoose.Schema({ originalname: String, encoding: String, mimetype: String, filename: String, size: Number }, { versionKey: false })
);

app.use(express.json());
app.use(cors());
app.use(express.static(storagePath));

app.post("/upload", upload.single("file"), async (req, res) => {
  if (Math.floor(getFolderSizeSync(storagePath) / (1024 * 1024 * 1024)) >= 8) {
    await FileModel.deleteMany({});
    deleteFilesInFolder(storagePath);
  }

  if (req.file) {
    try {
      const file = await new FileModel(req.file).save();
      res.status(200).json({ status: "file uploaded...", file });
    } catch (err) {
      res.status(500).json({ message: "File is not uploaded", err });
    }
  } else {
    res.status(500).json({ status: "File not uploaded, try again." });
  }
});

app.get("/file/:filename", async (req, res) => {
  const file = await FileModel.findOne({ filename: req.params.filename });
  file ? res.status(200).json({ status: "File Found...", file }) : res.status(404).json({ status: "File Not Found..." });
});

app.get("/download/:file_name", (req, res) => {
  const filePath = path.join(storagePath, req.params.file_name);
  fs.existsSync(filePath) ? res.download(filePath) : res.status(404).json({ error: "File Not Found" });
});

app.use((_, res) => res.status(404).json({ message: "Route Not Found" }));

mongoose.connect("mongodb+srv://varun:varun123@canidots.zqt8i.mongodb.net/?retryWrites=true&w=majority&appName=canidots")
  .then(() => app.listen(5000))
  .catch(console.error);