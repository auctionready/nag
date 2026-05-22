import * as aws from "@pulumi/aws";
import * as github from "@pulumi/github";

const apex = "auctionready.co.nz";
const subdomain = `nag.${apex}`;
const repoOwner = "auctionready";

// --- Route 53 CNAME ---
const zone = aws.route53.getZoneOutput({ name: apex });

new aws.route53.Record("pages-cname", {
  zoneId: zone.zoneId,
  name: subdomain,
  type: "CNAME",
  ttl: 300,
  records: [`${repoOwner}.github.io`],
});

const repository = new github.Repository("site", {
  name: "nag",
  visibility: "public",
});

// --- GitHub Pages config ---
new github.RepositoryPages("pages", {
  repository: repository.name,
  buildType: "workflow",
  cname: subdomain,
});
