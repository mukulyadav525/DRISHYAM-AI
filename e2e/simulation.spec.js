const { test, expect } = require("@playwright/test");

const API_BASE = process.env.DRISHYAM_E2E_API_BASE || "http://127.0.0.1:4100/api/v1";
const ADMIN_USER = process.env.DRISHYAM_E2E_ADMIN_USER || "admin";
const ADMIN_PASSWORD = process.env.DRISHYAM_E2E_ADMIN_PASSWORD || "password123";
const ADMIN_OTP = process.env.DRISHYAM_E2E_ADMIN_OTP || "19301930";

const REQUIRED_CONSENTS = [
  "ai_handoff",
  "transcript_analysis",
  "evidence_packaging",
];

function buildPhone(seed) {
  return `98765${String(seed).padStart(5, "0")}`.slice(-10);
}

async function parseJson(response) {
  const contentType = response.headers()["content-type"] || "";
  if (!contentType.includes("application/json")) {
    return {};
  }
  return response.json();
}

async function expectOk(response, context) {
  const payload = await parseJson(response);
  expect(response.ok(), `${context}: ${JSON.stringify(payload)}`).toBeTruthy();
  return payload;
}

async function loginAdmin(request) {
  const loginResponse = await request.post(`${API_BASE}/auth/login`, {
    form: {
      username: ADMIN_USER,
      password: ADMIN_PASSWORD,
    },
  });
  const loginPayload = await expectOk(loginResponse, "admin login");
  expect(loginPayload.mfa_required).toBeTruthy();

  const verifyResponse = await request.post(`${API_BASE}/auth/mfa/verify`, {
    data: { otp: ADMIN_OTP },
    headers: {
      Authorization: `Bearer ${loginPayload.access_token}`,
    },
  });
  const verifyPayload = await expectOk(verifyResponse, "admin mfa verify");
  expect(verifyPayload.mfa_verified).toBeTruthy();
  return verifyPayload.access_token;
}

async function recordConsent(request, phone) {
  const response = await request.post(`${API_BASE}/privacy/consent/record`, {
    data: {
      phone_number: phone,
      scopes: {
        ai_handoff: true,
        transcript_analysis: true,
        evidence_packaging: true,
        alerting_recovery: true,
      },
      channel: "SIMULATION_PORTAL",
      locale: "en-IN",
    },
  });
  await expectOk(response, `consent record for ${phone}`);
}

async function ensureCitizenAccess(request, phone) {
  await recordConsent(request, phone);
  const adminToken = await loginAdmin(request);

  const createResponse = await request.post(`${API_BASE}/auth/simulation/request`, {
    data: { phone_number: phone },
  });
  await expectOk(createResponse, `simulation request for ${phone}`);

  const listResponse = await request.get(`${API_BASE}/auth/simulation/list`, {
    headers: {
      Authorization: `Bearer ${adminToken}`,
    },
  });
  const requests = await expectOk(listResponse, "simulation request list");
  const match = requests.find((row) => row.phone_number === phone);
  expect(match, `simulation request row for ${phone}`).toBeTruthy();

  if (match.status !== "approved") {
    const approveResponse = await request.post(`${API_BASE}/auth/simulation/approve/${match.id}?approve=true`, {
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
    });
    await expectOk(approveResponse, `simulation approval for ${phone}`);
  }

  const statusResponse = await request.get(`${API_BASE}/auth/simulation/status/${phone}`);
  const statusPayload = await expectOk(statusResponse, `simulation status for ${phone}`);
  expect(statusPayload.status).toBe("approved");
  expect(statusPayload.access_token).toBeTruthy();
  return statusPayload.access_token;
}

async function findSimulationRequest(request, adminToken, phone) {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const listResponse = await request.get(`${API_BASE}/auth/simulation/list`, {
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
    });
    const requests = await expectOk(listResponse, "simulation request list");
    const match = requests.find((row) => row.phone_number === phone);
    if (match) {
      return match;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(`Simulation request row not found for ${phone}`);
}

async function bootstrapCitizenSession(page, request, phone) {
  const token = await ensureCitizenAccess(request, phone);
  await page.addInitScript(
    ({ sessionToken, username }) => {
      window.localStorage.setItem(
        "drishyam_auth",
        JSON.stringify({
          token: sessionToken,
          username,
          role: "common",
        }),
      );
    },
    { sessionToken: token, username: phone },
  );
}

test.describe("Simulation portal citizen journeys", () => {
  test("citizen can request access and land on the safety center", async ({ page, request }) => {
    const phone = buildPhone(31001);
    await recordConsent(request, phone);

    await page.goto("/");

    await page.getByTestId("citizen-phone-input").fill(phone);
    for (const scope of REQUIRED_CONSENTS) {
      await expect(page.getByTestId(`consent-checkbox-${scope}`)).toBeChecked();
    }

    await page.getByTestId("request-access-button").click();

    const adminToken = await loginAdmin(request);
    const createdRequest = await findSimulationRequest(request, adminToken, phone);

    if (createdRequest.status !== "approved") {
      const approveResponse = await request.post(`${API_BASE}/auth/simulation/approve/${createdRequest.id}?approve=true`, {
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
      });
      await expectOk(approveResponse, "citizen request approval from UI flow");
    }

    await expect(page.getByTestId("feature-upi")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText("Citizen Safety Center")).toBeVisible();
  });

  test("UPI Armor scans a suspicious message and routes the case", async ({ page, request }) => {
    const phone = buildPhone(31002);
    await bootstrapCitizenSession(page, request, phone);

    await page.goto("/");
    await expect(page.getByTestId("feature-upi")).toBeVisible();

    await page.getByTestId("feature-upi").click();
    await page.getByTestId("upi-tab-message").click();
    await page.getByTestId("upi-message-input").fill(
      "Urgent: your account will be blocked unless you approve the collect request from auditdesk@upi immediately.",
    );
    await page.getByTestId("upi-message-scan-button").click();

    await expect(page.getByText(/Fraud Probability/i)).toBeVisible();
    await expect(page.getByText(/Routed To Operations/i)).toBeVisible();
  });

  test("Bharat low-bandwidth flow logs a financial fraud report from keypad entry", async ({ page, request }) => {
    const phone = buildPhone(31003);
    await bootstrapCitizenSession(page, request, phone);

    await page.goto("/");
    await expect(page.getByTestId("feature-bharat")).toBeVisible();

    await page.getByTestId("feature-bharat").click();
    for (const key of ["1", "9", "3", "0"]) {
      await page.getByTestId(`bharat-key-${key}`).click();
    }

    await expect(page.getByTestId("bharat-category-financial-fraud")).toBeVisible();
    await page.getByTestId("bharat-category-financial-fraud").click();
    await page.getByTestId("bharat-key-2").click();
    await page.getByTestId("bharat-key-5").click();
    await page.getByTestId("bharat-key-0").click();
    await page.getByTestId("bharat-key-0").click();
    await page.getByPlaceholder("e.g. HDFC, SBI").fill("SBI");
    await page.getByTestId("bharat-proceed-context").click();
    await page.getByTestId("bharat-description-input").fill(
      "Caller claimed to be bank support and pushed a fake collect request for KYC unblock.",
    );
    await page.getByTestId("bharat-authenticate-details").click();
    await page.getByTestId("bharat-submit-report").click();

    await expect(page.getByText("Logged")).toBeVisible();
    await expect(page.getByText(/Routing Summary/i)).toBeVisible();
  });

  test("Recovery companion generates a bundle and refreshes case status", async ({ page, request }) => {
    const phone = buildPhone(31004);
    await bootstrapCitizenSession(page, request, phone);

    await page.goto("/");
    await expect(page.getByTestId("feature-recovery")).toBeVisible();

    await page.getByTestId("feature-recovery").click();
    await page.getByTestId("recovery-action-bundle").click();
    await expect(page.getByText(/bundle/i)).toBeVisible();

    await page.getByTestId("recovery-refresh-button").click();
    await expect(page.getByText(/bank_dispute_status|police_fir_status/i)).toBeVisible();
  });
});
