const express = require("express");
const { spawn } = require("child_process");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const WebSocket = require("ws");
const hbjs = require("handbrake-js"); // Asegúrate de que Handbrake-js esté instalado
const app = express();
const port = 3000;

app.use(
  cors({
    origin:
      "https://yt-downloader-wcyg.onrender.com:3000" || "http://localhost:3000",
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));

const server = app.listen(port, () =>
  console.log(`Servidor escuchando en http://localhost:${port}`)
);

const wss = new WebSocket.Server({ server });

function sendProgress(progress, type = "download") {
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({ progress, type }));
    }
  });
}

wss.on("connection", (ws) => {
  console.log("Cliente conectado");
  ws.on("error", (error) => console.error("WebSocket error:", error));
});

app.post("/downloadVideo", (req, res) => {
  const tempDir = path.join(__dirname, "temp");
  fs.readdir(tempDir, (err, files) => {
    if (err) {
      console.error("Error al acceder al directorio temporal:", err);
      return res
        .status(500)
        .send("No se puede acceder al directorio temporal.");
    }
    if (files.length > 0) {
      return res
        .status(400)
        .send("Operación en curso. Por favor, espera a que finalice.");
    }
    startDownloadProcess(req, res, tempDir);
  });
});

function startDownloadProcess(req, res, tempDir) {
  const { videoUrl, videoQuality, videoFormat } = req.body;
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }
  const outputPathTemplate = path.join(tempDir, "%(title)s.%(ext)s");
  const ytDlpProcess = spawn("yt-dlp", [
    "-f",
    `bestvideo[height<=?${videoQuality}]+bestaudio/best`,
    "--newline",
    "-o",
    outputPathTemplate,
    videoUrl,
  ]);

  ytDlpProcess.stdout.on("data", (data) => {
    const output = data.toString();
    const regex = /(\d+\.\d+)%/;
    const match = output.match(regex);
    if (match) {
      sendProgress(match[1], "download");
    }
  });

  ytDlpProcess.on("close", (code) => {
    if (code === 0) {
      console.log("Video descargado exitosamente.");
      fs.readdir(tempDir, (err, files) => {
        if (err) {
          console.error(
            "Error al listar archivos en el directorio temporal:",
            err
          );
          return res
            .status(500)
            .send("Error al procesar el archivo descargado.");
        }
        const downloadedFile = files.find((file) => file.endsWith(".webm"));
        if (downloadedFile) {
          const downloadedFilePath = path.join(tempDir, downloadedFile);
          if (videoFormat !== "webm") {
            const outputFilePath = downloadedFilePath.replace(
              ".webm",
              `.${videoFormat}`
            );
            // Convertir el video con Handbrake-js
            hbjs
              .spawn({
                input: downloadedFilePath,
                output: outputFilePath,
                format: videoFormat,
              })
              .on("error", (err) => {
                console.error("Error al convertir el video:", err);
                return res.status(500).send("Error al convertir el video.");
              })
              .on("progress", (progress) => {
                sendProgress(progress.percentComplete, "conversion");
              })
              .on("end", () => {
                sendFileAndCleanup(outputFilePath, res);
              });
          } else {
            sendFileAndCleanup(downloadedFilePath, res);
          }
        } else {
          console.error("No se encontró el archivo descargado.");
          res.status(404).send("Archivo descargado no encontrado.");
        }
      });
    } else {
      console.error("Error al descargar el video con yt-dlp.");
      res.status(500).send("Error al descargar el video.");
    }
  });
}

function sendFileAndCleanup(filePath, res) {
  res.download(filePath, path.basename(filePath), (downloadError) => {
    if (downloadError) {
      console.error("Error al enviar el archivo:", downloadError);
      res.status(500).send("Error al descargar el archivo");
    } else {
      console.log("Archivo enviado exitosamente.");
    }
    // Limpiar todo el directorio temporal después de enviar el archivo
    cleanTempDirectory(filePath);
  });
}

function cleanTempDirectory(filePath) {
  const tempDir = path.dirname(filePath);
  fs.readdir(tempDir, (err, files) => {
    if (err) {
      console.error("Error al listar archivos para limpieza:", err);
      return;
    }
    files.forEach((file) => {
      const tempFilePath = path.join(tempDir, file);
      fs.unlink(tempFilePath, (err) => {
        if (err) {
          console.error(
            `Error al eliminar el archivo temporal ${tempFilePath}:`,
            err
          );
        } else {
          console.log(`Archivo temporal ${tempFilePath} eliminado con éxito.`);
        }
      });
    });
  });
}
