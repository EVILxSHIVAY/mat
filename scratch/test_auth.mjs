// scratch/test_auth.mjs
async function run() {
  const baseUrl = "http://localhost:3000";
  console.log("Testing Login API & Page Endpoints...");

  const testAccounts = [
    { role: "ADMIN", email: "admin@pdv.com", password: "Admin@PDV2026!", expectedPath: "/" },
    { role: "SUPPLIER", email: "vasu@example.com", password: "Supplier@2026!", expectedPath: "/supplier" },
    { role: "VENDOR", email: "apex@example.com", password: "Vendor@2026!", expectedPath: "/vendor" },
  ];

  for (const acc of testAccounts) {
    console.log(`\n--- Testing ${acc.role} (${acc.email}) ---`);
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: acc.email,
        password: acc.password,
        role: acc.role,
        rememberMe: true,
      }),
    });

    const setCookie = res.headers.get("set-cookie");
    const data = await res.json();
    console.log(`Status: ${res.status}`);
    console.log(`Response:`, data);
    console.log(`Set-Cookie present: ${!!setCookie}`);

    if (setCookie) {
      // Extract pdv_session cookie
      const cookieMatch = setCookie.match(/pdv_session=([^;]+)/);
      const cookieHeader = cookieMatch ? `pdv_session=${cookieMatch[1]}` : "";

      // Test /api/auth/me
      const meRes = await fetch(`${baseUrl}/api/auth/me`, {
        headers: { Cookie: cookieHeader },
      });
      const meData = await meRes.json();
      console.log(`/api/auth/me status: ${meRes.status}, role: ${meData.user?.role}`);

      // Test accessing their dashboard
      const pageRes = await fetch(`${baseUrl}${acc.expectedPath}`, {
        headers: { Cookie: cookieHeader },
        redirect: "manual",
      });
      console.log(`Access ${acc.expectedPath} status: ${pageRes.status} (location: ${pageRes.headers.get("location")})`);

      // If supplier or vendor, test data API
      if (acc.role === "SUPPLIER") {
        const dataRes = await fetch(`${baseUrl}/api/supplier/data`, {
          headers: { Cookie: cookieHeader },
        });
        console.log(`/api/supplier/data status: ${dataRes.status}`);
      } else if (acc.role === "VENDOR") {
        const dataRes = await fetch(`${baseUrl}/api/vendor/data`, {
          headers: { Cookie: cookieHeader },
        });
        console.log(`/api/vendor/data status: ${dataRes.status}`);
      }
    }
  }
}

run().catch(console.error);
