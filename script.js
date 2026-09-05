const MAX_FILE_BYTES = 50 * 1024 * 1024;
const MAX_VIDEO_SECONDS = 60;
const DAILY_SUBMISSION_LIMIT = 3;
const DAILY_KEY_PREFIX = "egp_submission_count_";
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
const dailyStatus = document.getElementById("dailyStatus");

let previewUrl = null;
let selectedVideoDuration = null;

const cfg = window.EGP_CONFIG || {};
const supabaseClient = window.supabase.createClient(
  cfg.SUPABASE_URL,
  cfg.SUPABASE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

function localDateKey() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function dailyStorageKey() {
  return `${DAILY_KEY_PREFIX}${localDateKey()}`;
}

function getDailyCount() {
  const value = Number(localStorage.getItem(dailyStorageKey()) || "0");
  return Number.isFinite(value) && value >= 0 ? value : 0;
}

function incrementDailyCount() {
  const next = Math.min(DAILY_SUBMISSION_LIMIT, getDailyCount() + 1);
  localStorage.setItem(dailyStorageKey(), String(next));
  return next;
}

function submissionsRemaining() {
  return Math.max(0, DAILY_SUBMISSION_LIMIT - getDailyCount());
}

function updateDailyStatus() {
  const remaining = submissionsRemaining();
  if (!dailyStatus) return;
  dailyStatus.textContent = remaining > 0
    ? `${remaining} of ${DAILY_SUBMISSION_LIMIT} submissions remaining today on this device.`
    : `Today's ${DAILY_SUBMISSION_LIMIT}-submission limit has been reached on this device.`;
  dailyStatus.classList.toggle("limit-hit", remaining === 0);
  submitBtn.disabled = remaining === 0;
}

function showError(message) {
  successBox.classList.add("hidden");
  errorBox.textContent = message;
  errorBox.classList.remove("hidden");
  errorBox.scrollIntoView({ behavior: "smooth", block: "center" });
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

function resetSelectedFile() {
  videoInput.value = "";
  filePill.classList.add("hidden");
  videoPreview.classList.add("hidden");
  videoPreview.removeAttribute("src");
  selectedVideoDuration = null;
  if (previewUrl) URL.revokeObjectURL(previewUrl);
  previewUrl = null;
}

function setFile(file) {
  clearMessages();
  selectedVideoDuration = null;
  if (!file) return;

  if (!ALLOWED_TYPES.includes(file.type)) {
    resetSelectedFile();
    return showError("Please choose an MP4, MOV, M4V, or WebM video.");
  }
  if (file.size > MAX_FILE_BYTES) {
    resetSelectedFile();
    return showError("That video is larger than 50 MB. Please shorten or compress it and try again.");
  }

  fileName.textContent = file.name;
  fileSize.textContent = formatBytes(file.size);
  filePill.classList.remove("hidden");

  if (previewUrl) URL.revokeObjectURL(previewUrl);
  previewUrl = URL.createObjectURL(file);
  videoPreview.src = previewUrl;
  videoPreview.classList.remove("hidden");

  videoPreview.onloadedmetadata = () => {
    selectedVideoDuration = Number(videoPreview.duration);
    if (Number.isFinite(selectedVideoDuration) && selectedVideoDuration > MAX_VIDEO_SECONDS + 0.25) {
      resetSelectedFile();
      showError("Please keep the story video to 60 seconds or less.");
    }
  };
}

videoInput.addEventListener("change", () => setFile(videoInput.files[0]));
removeFile.addEventListener("click", resetSelectedFile);

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

function safeExtension(file) {
  const nameExt = (file.name.split(".").pop() || "").toLowerCase();
  if (["mp4", "mov", "m4v", "webm"].includes(nameExt)) return nameExt;
  const map = {
    "video/mp4": "mp4",
    "video/quicktime": "mov",
    "video/x-m4v": "m4v",
    "video/webm": "webm"
  };
  return map[file.type] || "mp4";
}

async function uploadSubmission(payload, file) {
  const id = crypto.randomUUID();
  const day = new Date().toISOString().slice(0, 10);
  const ext = safeExtension(file);
  const videoPath = `${day}/${id}.${ext}`;

  const { error: uploadError } = await supabaseClient.storage
    .from(cfg.STORAGE_BUCKET || "story-videos")
    .upload(videoPath, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type
    });

  if (uploadError) throw new Error(`Video upload failed: ${uploadError.message}`);

  const row = {
    storyteller_name: payload.storytellerName,
    age_group: payload.ageGroup,
    guardian_email: payload.guardianEmail || null,
    review_consent: true,
    publishing_permission: payload.publishingPermission,
    video_path: videoPath
  };

  const { error: insertError } = await supabaseClient
    .from(cfg.SUBMISSIONS_TABLE || "submissions")
    .insert(row);

  if (insertError) {
    throw new Error(`Video uploaded, but submission details could not be saved: ${insertError.message}`);
  }
}

form.addEventListener("submit", async event => {
  event.preventDefault();
  clearMessages();
  updateGuardianRequirement();

  if (submissionsRemaining() <= 0) {
    updateDailyStatus();
    return showError("You have reached the maximum of 3 submissions for today on this device. Please come back tomorrow.");
  }

  const file = videoInput.files[0];
  const name = document.getElementById("name").value.trim();

  if (!name) return showError("Please enter a storyteller name or nickname.");
  if (!ageGroup.value) return showError("Please choose an age group.");
  if (isMinorAgeGroup(ageGroup.value) && !guardianEmail.value.trim()) {
    return showError("Please enter a parent or guardian email for storytellers under 18.");
  }
  if (!file) return showError("Please choose your story video.");
  if (file.size > MAX_FILE_BYTES) return showError("Please keep the video under 50 MB.");
  if (Number.isFinite(selectedVideoDuration) && selectedVideoDuration > MAX_VIDEO_SECONDS + 0.25) {
    return showError("Please keep the story video to 60 seconds or less.");
  }
  if (!reviewConsent.checked) return showError("Permission to review the submitted video is required.");

  const payload = {
    storytellerName: name,
    ageGroup: ageGroup.value,
    guardianEmail: guardianEmail.value.trim(),
    publishingPermission: publishConsent.checked
  };

  submitBtn.disabled = true;
  submitBtn.firstElementChild.textContent = "Uploading…";

  try {
    await uploadSubmission(payload, file);
    incrementDailyCount();
    const remaining = submissionsRemaining();
    window.location.href = `thank-you.html?remaining=${remaining}`;
  } catch (error) {
    showError(error.message || "Something went wrong while sending the video. Please try again.");
    submitBtn.disabled = false;
    submitBtn.firstElementChild.textContent = "Submit Story";
  }
});

updateDailyStatus();
updateGuardianRequirement();
