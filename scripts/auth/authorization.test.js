import * as CHECK from "../../common/common_check.js";
import * as ENDPOINT from "../../common/endpoint_const.js";
import { TestHelper } from "../../common/test_helper.js";
import * as TAGS from "../../tags/tags_const.js";

export function authorization({
  clientId,
  userCd,
  userPassword,
  realm,
}) {
  TestHelper.auth(ENDPOINT.AUTHORIZATION.desc, {
    clientId,
    userCd,
    userPassword,
    realm,
  }, [
    CHECK.createStatusCodeCheck(),
  ]);
}
