import { group, sleep } from "k6";
import * as CHECK from "../../../common/common_check.js";
import * as ENDPOINT from "../../../common/endpoint_const.js";
import { TestHelper } from "../../../common/test_helper.js";
import { CommonFunction } from "../../../common/common_function.js";
import * as ENVIRONMENT from "../../../common/environment_const.js";
import * as TAGS from "../../../tags/tags_const.js";

/**
 * @function 小口出金～誤打訂正の一連操作
 * @memberof 金銭管理.小口出金
 * @description
 * {@link TAGS.POS}
 * {@link TAGS.MONEY_MANAGEMENT}
 * {@link TAGS.MISPRINT_CORRECTION}
 * {@link TAGS.RETAIL_WITHDRAWAL}
 * {@link TAGS.TRADE_CALL}
 * {@link TAGS.THERE_IS_A_REASON_LOGICAL_BALANCE_CHANGE}
 * {@link TAGS.BARCODE_SCAN}
 * ### テスト観点
 * * 小口出金から誤打訂正（小口出金）までの一連の確認を行う
 * * * ・小口出金
 * * * 出金額：2000円
 * * * 出金理由：ドラッグ出金
 * * * サブ理由：出金その他
 * * * ・誤打訂正
 * * * 上記の小口出金取引で誤打訂正を行う（小口出金のレシートスキャン）
 * 
 * ---
 * ### テスト方法/シナリオ
 * | Step | 手順 | エンドポイント |
 * | :-: | :--- | :--- |
 * | 1 | 従業員確認対応 | `/employee/checkoperation` |
 * | 2 | 小口出金 | `/cash/dispense` |
 * | 3 | 【誤打訂正】小口出金 | `/void/dispense` |
 * 
 * ---
 * ### 前提条件
 * * 小口出金は成功する
 * 
 * ---
 * ### テストデータ
 * * 1. 従業員バーコード: 10000010
 * * リクエストデータ
 * * 2. amount = 2000
 * * 3. reason_cd = "ドラッグ出金"
 * * 4. sub_reason_cd = "出金その他"
 * * 5. operation_method = 42
 * 
 * ---
 * ### 期待結果
 * * #### 1. `/employee/checkoperation`
 * * \- employee.employee_cd を取得する
 * * #### 2. 小口出金 `/cash/dispense`
 * * \- レシートに以下の情報が印字されること:
 * *    「小口出金」「出金」「2,000」（リクエストデータのフォーマット）
 * *    「確:employee.employee_cd」（Step1 で取得した値）
 * * #### 3. 誤打訂正小口出金 `/void/dispense`
 * * \- レシートに以下の情報が印字されること:
 * *    「誤打訂正」「小口出金」「出金」「2,000」（リクエストデータのフォーマット）
 * *    「確:employee.employee_cd」（Step1 で取得した値）
 */
export function TC_040311001_VoidDispense() {
  group("TC_040311001 小口出金～誤打訂正の一連操作", () => {
    const step = {
      employeeCheckoperation: CommonFunction.getFullDesc(ENDPOINT.EMPLOYEE_CHECKOPERATION),
      cashDispense: CommonFunction.getFullDesc(ENDPOINT.CASH_DISPENSE),
      voidDispense: CommonFunction.getFullDesc(ENDPOINT.VOID_DISPENSE),
    };

    const amount = 2000; // Test data
    const stringAmount = CommonFunction.convertToCurrency(amount);
    const reasonCd = "ドラッグ出金"; // Test data
    const subReasonCd = "出金その他"; // Test data
    const operationMethod = 42; // Test data. 操作対象 (42: 小口出金)

    const empolyeeCd = TestHelper.employeeCheckoperation(step.employeeCheckoperation, {
      employeeBarcode: ENVIRONMENT.EMPLOYEE_BARCODE,
      operationMethod,
    }, [
      CHECK.createStatusCodeCheck(),
    ]).result?.employee_cd;

    const cashDispenseResponse = TestHelper.cashDispense(step.cashDispense, {
      amount,
      reasonCd,
      subReasonCd,
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify receipt data must contain information: 小口出金, 出金, amount dispense and employee cd",
        expected: true,
        actual: (res) => CommonFunction.includesItems([
          "小口出金",
          "出金",
          stringAmount,
          empolyeeCd,
        ], res.result?.receipts?.[0]?.receipt_data),
      }),
    ]);

    sleep(3);

    const receiptNo = cashDispenseResponse.result?.receipt_no;
    const businessDay = cashDispenseResponse.result?.business_day;

    const receiptBarcode = CommonFunction.getReceiptBarcode({
      receiptNo,
      businessDay,
      barcodeStart: ENVIRONMENT.SALES_RECEIPT_BARCODE_START,
    });

    TestHelper.voidDispense(step.voidDispense, {
      receiptBarcode,
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify receipt data must contain information: 誤打訂正, 小口出金, 出金, amount dispense and employee cd",
        expected: true,
        actual: (res) => CommonFunction.includesItems([
          "誤打訂正",
          "小口出金",
          "出金",
          stringAmount,
          empolyeeCd,
        ], res.result?.receipts?.[0]?.receipt_data),
      }),
    ]);
  });
}
