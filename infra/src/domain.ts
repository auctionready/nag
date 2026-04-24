import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";

export interface DomainArgs {
  apiId: pulumi.Output<string>;
  stageName: pulumi.Output<string>;
  domainName: string;
  hostedZoneName: string;
}

export interface Domain {
  url: pulumi.Output<string>;
}

export const createDomain = (args: DomainArgs): Domain => {
  const zone = aws.route53.getZoneOutput({
    name: args.hostedZoneName,
    privateZone: false,
  });

  const cert = new aws.acm.Certificate("nag-api-cert", {
    domainName: args.domainName,
    validationMethod: "DNS",
  });

  const validationOption = cert.domainValidationOptions[0];

  const validationRecord = new aws.route53.Record("nag-api-cert-validation", {
    name: validationOption.resourceRecordName,
    type: validationOption.resourceRecordType,
    records: [validationOption.resourceRecordValue],
    zoneId: zone.zoneId,
    ttl: 60,
    allowOverwrite: true,
  });

  const certValidated = new aws.acm.CertificateValidation(
    "nag-api-cert-validated",
    {
      certificateArn: cert.arn,
      validationRecordFqdns: [validationRecord.fqdn],
    },
  );

  const apiDomain = new aws.apigatewayv2.DomainName("nag-api-domain", {
    domainName: args.domainName,
    domainNameConfiguration: {
      certificateArn: certValidated.certificateArn,
      endpointType: "REGIONAL",
      securityPolicy: "TLS_1_2",
    },
  });

  new aws.apigatewayv2.ApiMapping("nag-api-mapping", {
    apiId: args.apiId,
    domainName: apiDomain.id,
    stage: args.stageName,
  });

  new aws.route53.Record("nag-api-alias", {
    name: args.domainName,
    type: "A",
    zoneId: zone.zoneId,
    aliases: [
      {
        name: apiDomain.domainNameConfiguration.targetDomainName,
        zoneId: apiDomain.domainNameConfiguration.hostedZoneId,
        evaluateTargetHealth: false,
      },
    ],
  });

  return {
    url: pulumi.interpolate`https://${args.domainName}/`,
  };
};
