import * as aws from "@pulumi/aws";
import * as command from "@pulumi/command";
import * as github from "@pulumi/github";
import * as pulumi from "@pulumi/pulumi";

const apex = "auctionready.co.nz";
const subdomain = `nag.${apex}`;
const owner = "auctionready";

// --- Route 53 CNAME ---
const zone = aws.route53.getZoneOutput({ name: apex });

new aws.route53.Record("pages-cname", {
  zoneId: zone.zoneId,
  name: subdomain,
  type: "CNAME",
  ttl: 300,
  records: [`${owner}.github.io`],
});

const repo = new github.Repository("site", {
  name: "nag",
  visibility: "public",
});

// --- GitHub Pages config ---
new github.RepositoryPages("pages", {
  repository: repo.name,
  buildType: "workflow",
  cname: subdomain,
});

// --- github-pages environment, no branch restrictions ---
new github.RepositoryEnvironment("pages-env", {
  repository: repo.name,
  environment: "github-pages",
  // omit deploymentBranchPolicy entirely = all branches allowed
});

new command.local.Command(
  "enforce-https",
  {
    create: pulumi.interpolate`gh api -X PUT repos/${owner}/${repo.name}/pages -F https_enforced=true`,
    // Re-run if the repo identity changes
    triggers: [repo.id],
  },
  { dependsOn: [repo] },
);
