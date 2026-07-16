window.setTimeout(() => document.documentElement.classList.remove("app-loading"), 2_000);

if (window.location.hostname === "nicklalo.github.io") {
  const analytics = document.createElement("script");
  analytics.defer = true;
  analytics.src = "https://static.cloudflareinsights.com/beacon.min.js";
  analytics.dataset.cfBeacon = JSON.stringify({ token: "1cca41536fb649218b67d2b5127fe973" });
  document.head.append(analytics);
}
