import * as CHECK from "../../common/common_check.js";
import * as ENVIRONMENT from "../../common/environment_const.js";
import * as ENDPOINT from "../../common/endpoint_const.js";
import { TestHelper } from "../../common/test_helper.js";

export function signin() {
  TestHelper.signin(ENDPOINT.SIGNIN.desc, ENVIRONMENT.EMPLOYEE_BARCODE, [
    CHECK.createStatusCodeCheck(),
  ]);
}
