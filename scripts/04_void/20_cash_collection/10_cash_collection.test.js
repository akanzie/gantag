import { group } from "k6";
import * as CHECK from "../../../common/common_check.js";
import * as ENDPOINT from "../../../common/endpoint_const.js";
import { TestHelper } from "../../../common/test_helper.js";
import { CommonFunction } from "../../../common/common_function.js";
import { CASH_TYPE } from "../../../common/constant/cash_type.js";
import * as TAGS from "../../../tags/tags_const.js";

/**
 * @function 現金回収の動き
 * @memberof 金銭管理.紙幣回収レシート
 * @description
 * {@link TAGS.POS}
 * {@link TAGS.MONEY_MANAGEMENT}
 * {@link TAGS.COLLECT}
 * {@link TAGS.BANKNOTE_COLLECTION_RECEIPT}
 * ### テスト観点
 * * 回収した現金が入力できる。
 * * * ・回収金額20,000円を入力する
 * * テスト観点
 * * \- レシートに以下の情報が印字されること:
 * *    「〇〇円      〇〇枚」
 * *    「回収合計額」
 * * \- business_day が有効な日時であること
 * 
 * ---
 * ### テスト方法/シナリオ
 * | Step | 手順 | エンドポイント |
 * | :-: | :--- | :--- |
 * | 1 | 現金回収 | `/cash/collect` |
 * 
 * ---
 * ### 前提条件
 * * 特になし
 * 
 * ---
 * ### テストデータ
 * * Request データ
 * * 1.collect_type: 2
 * * 2.collect_cash_info:
 * * * \+ total_amount: 20000
 * * * \+ cash_type: 7
 * * * \+ amount: 20
 * 
 * ---
 * ### 期待結果
 * * #### 1. 現金回収 `/cash/collect`
 * * \- レシートに以下の情報が印字されること:
 * *    「1000円      20枚」
 * *    「回収合計額」
 * *    collect_cash_info.total_amount（カンマ区切りフォーマット）
 * * \- business_day が有効な日時であること
 */
export function TC_042010001_CashCollect() {
  group("TC_042010001 現金回収の動き", () => {
    const step = {
      cashCollect: CommonFunction.getFullDesc(ENDPOINT.CASH_COLLECT),
    };

    const collectType = 2; // Test data. 回収種別 (2: 現金回収)
    const collectCashInfo = {
      total_amount: 20000, // Test data. Equals 1000円 * 20
      cash_details: [
        {
          cash_type: CASH_TYPE.BILL1000.TYPE,
          count: 20, // Test data
        },
      ],
    };

    TestHelper.cashCollect(step.cashCollect, {
      collectType,
      collectCashInfo,
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify receipt data must contain information 現金回収",
        expected: true,
        actual: (res) => {
          const stringTotalAmount = CommonFunction.convertToCurrency(collectCashInfo.total_amount);
          return CommonFunction.checkReceiptData([
            "1000円      20枚",
            "回収合計額",
            stringTotalAmount,
          ], res.result?.receipts);
        },
      }),
      CHECK.createEqualsCheck({
        name: "Verify business day must be a valid datetime",
        expected: true,
        actual: (res) => CommonFunction.isValidDate(res.result?.business_day?.split("T")?.[0]),
      }),
    ]);
  });
}
