import * as ENVIRONMENT from "../common/environment_const.js";
import { authorization } from "./auth/authorization.test.js";
import { signin } from "./auth/signin.test.js";
import { Invoker } from "../common/invoker.js";
import * as mod from "./index.js";
const data = open('./testcases.json');
const testcases = JSON.parse(data);
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.1.0/index.js';
import { TestHelper } from "../common/test_helper.js";
import * as TAGS from "../tags/tags_const.js";

export const options = {
  tags: {
    name: "bff-pos_APIs_test",
  },
  insecureSkipTLSVerify: true,
  throw: true,
};

export default function () {
  const protocolDomainPort = __ENV.PROTOCOL_DOMAIN_PORT ?? ENVIRONMENT.PROTOCOL_DOMAIN_PORT;
  const clientId = __ENV.CLIENT_ID ?? ENVIRONMENT.CLIENT_ID;
  const userCd = __ENV.USER_CD ?? ENVIRONMENT.USER_CD;
  const userPassword = __ENV.USER_PASSWORD ?? ENVIRONMENT.USER_PASSWORD;
  const realm = __ENV.REALM ?? ENVIRONMENT.REALM;
  const corporateCd = __ENV.CORPORATE_CD ?? ENVIRONMENT.CORPORATE_CD;
  const storeCd = __ENV.STORE_CD ?? ENVIRONMENT.STORE_CD;
  const posCd = __ENV.POS_CD ?? ENVIRONMENT.POS_CD;
  const businessDay = __ENV.BUSINESS_DAY ?? ENVIRONMENT.BUSINESS_DAY;

  const invoker = new Invoker(protocolDomainPort);
  TestHelper.invoker = invoker;

  authorization({ clientId, userCd, userPassword, realm });
  signin();

  for (const testcase of testcases) {
    const fn = mod[testcase];
    if (fn) {
      console.log(`Running testCase ${testcase}`);
      fn(invoker);
      console.log(`Ending testCase ${testcase}`);
    } else {
      console.warn(`Not found testCase ${testcase}`);
    }
  }
}

export function handleSummary(data) {
  const totalTestCase = data.root_group.groups.length - 2; 
  const failsTestCase = getFailsTestCases(data.root_group.groups);
  const summaryText = `実行ケース数:${totalTestCase}、失敗ケース数：${failsTestCase.length}`;
  const failsData = {
    ...data,
    root_group: {
      ...data.root_group,
      groups: failsTestCase
    },
    metrics: {}
  };

  const summaryData = {
    ...data,
    root_group: {
      ...data.root_group,
      groups: buildSummary(summaryText)
    },
    metrics: {}
  };

  return {
    './logs/log_summary_failure.txt': textSummary(failsData, { enableColors: false }),
    './logs/log_summary.txt': textSummary(data, { enableColors: false }),
    stdout: textSummary(summaryData, { enableColors: false }).replace(/█/g, '')
  }
}

function getFailsTestCases(groups) {
  return groups.filter(group =>
    group.groups.some(sub =>
      sub.checks?.some(check => check.fails > 0)
    )
  );
}

function buildSummary(name) {
  return [{
    name,
    path: "",
    id: "",
    groups: [],
    checks: []
  }];
}
