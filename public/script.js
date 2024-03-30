function updateProgressBar(percentage, message = "Descargando...") {
  const progressBar = document.getElementById("videoProgressBar");
  const progressText = document.getElementById("progressText"); // Obtén el elemento de texto del progreso

  if (progressBar && progressText) {
    progressBar.style.width = percentage + "%"; // Actualiza la anchura de la barra
    progressText.textContent = percentage + "%"; // Actualiza el texto de forma independiente
    showStatusMessage(message);
  }
}

function resetProgressBar() {
  const progressBar = document.getElementById("videoProgressBar");
  if (progressBar) {
    progressBar.style.width = "0%";
    progressBar.textContent = "0%";
  }
}

function showStatusMessage(message) {
  const statusMessage = document.getElementById("statusMessage");
  if (statusMessage) {
    statusMessage.textContent = message;
    statusMessage.style.display = "block";
  }
}

function hideStatusMessage() {
  const statusMessage = document.getElementById("statusMessage");
  if (statusMessage) {
    statusMessage.style.display = "none";
  }
}

function downloadVideo() {
  showStatusMessage("Procesando...");
  const ws = new WebSocket("ws://localhost:3000");

  ws.onmessage = function (event) {
    const data = JSON.parse(event.data);
    if (data.progress !== undefined) {
      // Actualiza el mensaje de estado dependiendo del tipo de progreso
      const message =
        data.type === "download" ? "Descargando..." : "Convirtiendo...";
      updateProgressBar(data.progress, message);
      if (data.progress === 100 && data.type === "conversion") {
        // Se espera al mensaje final de conversión para cambiar a "Listo"
        setTimeout(() => {
          resetProgressBar();
          showStatusMessage("Listo");
          setTimeout(hideStatusMessage, 2000);
        }, 1000);
      }
    }
  };

  ws.onopen = function () {
    fetch("/downloadVideo", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        videoUrl: document.getElementById("videoUrl").value,
        videoQuality: document.getElementById("videoQuality").value,
        videoFormat: document.getElementById("videoFormat").value,
      }),
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error("Network response was not ok.");
        }
        return response.blob().then((blob) => {
          const contentDisposition = response.headers.get(
            "Content-Disposition"
          );
          let filename = "downloaded_video";
          const matches = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/.exec(
            contentDisposition
          );
          if (matches != null && matches[1]) {
            filename = matches[1].replace(/['"]/g, "");
          }
          return { blob, filename };
        });
      })
      .then(({ blob, filename }) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.style.display = "none";
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        ws.close();
      })
      .catch((error) => {
        console.error("Error:", error);
        alert("Error al descargar el video.");
        resetProgressBar();
        hideStatusMessage();
        ws.close();
      });
  };

  ws.onerror = function (error) {
    console.error("WebSocket error:", error);
    alert(
      "No se pudo conectar al servidor para actualizar la barra de progreso."
    );
    resetProgressBar();
    hideStatusMessage();
  };
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", function () {
    document
      .getElementById("downloadButton")
      .addEventListener("click", downloadVideo);
  });
} else {
  document
    .getElementById("downloadButton")
    .addEventListener("click", downloadVideo);
}
