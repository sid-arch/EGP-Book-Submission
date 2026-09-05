const MAX_FILE_BYTES = 250 * 1024 * 1024;
const ALLOWED_TYPES = [
  "video/mp4",
  "video/quicktime",
  "video/webm",
  "video/x-m4v"
];

const form = document.getElementById("storyForm");
const ageGroup = document.getElementById("ageGroup");
const guardianEmail = document.getElementById("guardianEmail");
const videoInput = document.getElementById("videoInput");
const uploadZone = document.getElementById("uploadZone");
const filePill = document.getElementById("filePill");
const fileName = document.getElementById("fileName");
const fileSize = document.getElementById("fileSize");
const removeFile = document.getElementById("removeFile");
const videoPreview = document.getElementById("videoPreview");
const reviewConsent = document.getElementById("reviewConsent");
const publishConsent = document.getElementById("publishConsent");
const submitBtn = document.getElementById("submitBtn");
const errorBox = document.getElementById("errorBox");
const successBox = document.getElementById("successBox");

let previewUrl = null;

function showError(message) {
  successBox.classList.add("hidden");
  errorBox.textContent = message;
  errorBox.classList.remove("hidden");
  errorBox.scrollIntoView({ behavior: "smooth", block: "center" });
}

function showSuccess(message) {
  errorBox.classList.add("hidden");
  successBox.textContent = message;
  successBox.classList.remove("hidden");
  successBox.scrollIntoView({ behavior: "smooth", block: "center" });
}

function clearMessages() {
  errorBox.classList.add("hidden");
  successBox.classList.add("hidden");
}

function formatBytes(bytes) {
  const mb = bytes / (1024 * 1024);
  return `${mb < 10 ? mb.toFixed(1) : Math.round(mb)} MB`;
}

function isMinorAgeGroup(value) {
  return ["6–8", "9–11", "12–14", "15–17"].includes(value);
}

function updateGuardianRequirement() {
  const required = isMinorAgeGroup(ageGroup.value);
  guardianEmail.required = required;
  guardianEmail.setAttribute("aria-required", String(required));
}

ageGroup.addEventListener("change", updateGuardianRequirement);

function setFile(file) {
  clearMessages();

  if (!file) return;
  if (!ALLOWED_TYPES.includes(file.type)) {
    videoInput.value = "";
    showError("Please choose an MP4, MOV, M4V, or WebM video.");
    return;
  }
  if (file.size > MAX_FILE_BYTES) {
    videoInput.value = "";
    showError("That video is larger than 250 MB. Please shorten or compress it and try again.");
    return;
  }

  fileName.textContent = file.name;
  fileSize.textContent = formatBytes(file.size);
  filePill.classList.remove("hidden");

  if (previewUrl) URL.revokeObjectURL(previewUrl);
  previewUrl = URL.createObjectURL(file);
  videoPreview.src = previewUrl;
  videoPreview.classList.remove("hidden");
}

videoInput.addEventListener("change", () => setFile(videoInput.files[0]));

removeFile.addEventListener("click", () => {
  videoInput.value = "";
  filePill.classList.add("hidden");
  videoPreview.classList.add("hidden");
  videoPreview.removeAttribute("src");
  if (previewUrl) URL.revokeObjectURL(previewUrl);
  previewUrl = null;
});

["dragenter", "dragover"].forEach(eventName => {
  uploadZone.addEventListener(eventName, event => {
    event.preventDefault();
    uploadZone.classList.add("dragging");
  });
});
["dragleave", "drop"].forEach(eventName => {
  uploadZone.addEventListener(eventName, event => {
    event.preventDefault();
    uploadZone.classList.remove("dragging");
  });
});

uploadZone.addEventListener("drop", event => {
  const file = event.dataTransfer.files?.[0];
  if (!file) return;

  const dt = new DataTransfer();
  dt.items.add(file);
  videoInput.files = dt.files;
  setFile(file);
});

async function submitToEndpoint(payload, file) {
  const endpoint = window.EGP_CONFIG?.UPLOAD_ENDPOINT?.trim();

  if (!endpoint || endpoint.includes("YOUR-UPLOAD-ENDPOINT")) {
    throw new Error(
      "UPLOAD_NOT_CONFIGURED"
    );
  }

  const data = new FormData();
  data.append("video", file);
  Object.entries(payload).forEach(([key, value]) => data.append(key, value));

  const response = await fetch(endpoint, {
    method: "POST",
    body: data
  });

  if (!response.ok) {
    let message = "Upload failed. Please try again.";
    try {
      const result = await response.json();
      if (result?.message) message = result.message;
    } catch (_) {}
    throw new Error(message);
  }

  return response;
}

form.addEventListener("submit", async event => {
  event.preventDefault();
  clearMessages();
  updateGuardianRequirement();

  const file = videoInput.files[0];
  const name = document.getElementById("name").value.trim();

  if (!name) return showError("Please enter a storyteller name or nickname.");
  if (!ageGroup.value) return showError("Please choose an age group.");
  if (isMinorAgeGroup(ageGroup.value) && !guardianEmail.value.trim()) {
    return showError("Please enter a parent or guardian email for storytellers under 18.");
  }
  if (!file) return showError("Please choose your story video.");
  if (!reviewConsent.checked) {
    return showError("Permission to review the submitted video is required.");
  }

  const payload = {
    storytellerName: name,
    ageGroup: ageGroup.value,
    guardianEmail: guardianEmail.value.trim(),
    reviewConsent: "yes",
    publishingPermission: publishConsent.checked ? "yes" : "no",
    submittedAt: new Date().toISOString()
  };

  submitBtn.disabled = true;
  submitBtn.firstElementChild.textContent = "Sending Story…";

  try {
    await submitToEndpoint(payload, file);
    showSuccess("Story sent! 🎉 Thanks for sharing your EGP creation with us.");
    form.reset();
    filePill.classList.add("hidden");
    videoPreview.classList.add("hidden");
    videoPreview.removeAttribute("src");
    updateGuardianRequirement();
  } catch (error) {
    if (error.message === "UPLOAD_NOT_CONFIGURED") {
      showError(
        "This demo page is ready, but the private video-upload endpoint has not been connected yet. Add it in config.js before publishing the QR code."
      );
    } else {
      showError(error.message || "Something went wrong while sending the video. Please try again.");
    }
  } finally {
    submitBtn.disabled = false;
    submitBtn.firstElementChild.textContent = "Send My Story";
  }
});
