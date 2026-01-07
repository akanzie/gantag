import { group, sleep } from "k6";
import * as CHECK from "../../../common/common_check.js";
import * as ENDPOINT from "../../../common/endpoint_const.js";
import * as ENVIRONMENT from "../../../common/environment_const.js";
import { TestHelper } from "../../../common/test_helper.js";
import { CommonFunction } from "../../../common/common_function.js";
import * as TAGS from "../../../tags/tags_const.js";

/**
 * @function 小口入金～誤打訂正の一連操作
 * @memberof 金銭管理.小口入金
 * @description
 * {@link TAGS.POS}
 * {@link TAGS.MONEY_MANAGEMENT}
 * {@link TAGS.MISPRINT_CORRECTION}
 * {@link TAGS.RETAIL_DEPOSIT}
 * {@link TAGS.TRADE_CALL}
 * {@link TAGS.THERE_IS_A_REASON_LOGICAL_BALANCE_CHANGE}
 * {@link TAGS.BARCODE_SCAN}
 * ### テスト観点
 * * 小口入金から誤打訂正（小口入金）までの一連の確認を行う
 * * 確認ステップ：
 * * * ・小口入金
 * * * \+ 入金額：10000円
 * * * \+ 入金理由：ドラッグ入金
 * * * \+ サブ理由：入金その他
 * * * ・誤打訂正
 * * * \+ 上記の小口入金取引で誤打訂正を行う（小口入金レシートスキャン）
 * * * \+  小口入金レシートスキャン
 * 
 * ---
 * ### テスト方法/シナリオ
 * | Step | 手順 | エンドポイント |
 * | :-: | :--- | :--- |
 * | 1 | 小口入金 | `/cash/deposit` |
 * | 2 | 誤打訂正小口入金 | `/void/deposit` |
 * 
 * ---
 * ### 前提条件
 * * 特になし
 * 
 * ---
 * ### テストデータ
 * * リクエストデータ:
 * * 1.amount = 10000
 * * 2.reason_cd = "ドラッグ入金"
 * * 3.sub_reason_cd = "入金その他"
 * 
 * ---
 * ### 期待結果
 * * #### 1. 小口入金 `/cash/deposit`
 * * \- レシートに以下の情報が印字されること:
 * *    「小口入金」「入金」「10,000」（テストデータ）
 * * \- business_day が有効な日付であること
 * * #### 2. 誤打訂正小口入金 `/void/deposit`
 * * \- レシートに以下の情報が印字されること:
 * *    「誤打訂正」「小口入金」「入金」「10,000」（テストデータ）
 * * \- business_day が有効な日付であること
 */
export function TC_040412001_VoidDeposit() {
  group("TC_040412001 小口入金～誤打訂正の一連操作", () => {
    const step = {
      cashDeposit: CommonFunction.getFullDesc(ENDPOINT.CASH_DEPOSIT),
      voidDeposit: CommonFunction.getFullDesc(ENDPOINT.VOID_DEPOSIT),
    };

    const amount = 10000; // Test data
    const amountExpected = CommonFunction.convertToCurrency(amount);

    const cashDepositResponse = TestHelper.cashDeposit(step.cashDeposit, {
      amount,
      reasonCd: "ドラッグ入金", // Test data
      subReasonCd: "入金その他", // Test data
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify receipt data must contain information 小口入金",
        expected: true,
        actual: (res) => {
          return CommonFunction.includesItems([
            "小口入金",
            "入金",
            amountExpected,
          ], res.result?.receipts?.[0]?.receipt_data);
        },
      }),
      CHECK.createEqualsCheck({
        name: "Verify business day must be a valid date",
        expected: true,
        actual: (res) => {
          return CommonFunction.isValidDate(res.result?.business_day);
        },
      }),
    ]);

    sleep(3);

    const salesReceiptNo = cashDepositResponse.result?.receipt_no;
    const salesBusinessDay = cashDepositResponse.result?.business_day;

    const receiptBarcode = CommonFunction.getReceiptBarcode({
      receiptNo: salesReceiptNo,
      businessDay: salesBusinessDay,
      barcodeStart: ENVIRONMENT.SALES_RECEIPT_BARCODE_START,
    });

    TestHelper.voidDeposit(step.voidDeposit, {
      receiptBarcode,
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify receipt data must contain information 誤打訂正",
        expected: true,
        actual: (res) => {
          return CommonFunction.includesItems([
            "誤打訂正",
            "小口入金",
            "入金",
            amountExpected,
          ], res.result?.receipts?.[0]?.receipt_data);
        },
      }),
      CHECK.createEqualsCheck({
        name: "Verify business day must be a valid date",
        expected: true,
        actual: (res) => {
          return CommonFunction.isValidDate(res.result?.business_day?.split("T")?.[0]);
        },
      }),
    ]);
  });
}
