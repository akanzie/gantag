import { group } from "k6";
import * as CHECK from "../../../common/common_check.js";
import * as ENDPOINT from "../../../common/endpoint_const.js";
import { TestHelper } from "../../../common/test_helper.js";
import { CommonFunction } from "../../../common/common_function.js";
import { CASH_TYPE } from "../../../common/constant/cash_type.js";
import * as TAGS from "../../../tags/tags_const.js";

/**
 * @function 釣銭追加の動き
 * @memberof 開局.釣銭準備金設定
 * @description
 * {@link TAGS.POS}
 * {@link TAGS.OPENING}
 * {@link TAGS.CHANGE_RESERVE_SETTING}
 * {@link TAGS.ADDITION}
 * ### テスト観点
 * * 釣銭追加金額が入力できる。
 * * * ・釣銭追加金額30,000円を入力する
 * * テスト観点
 * * レシートに「追加合計額」が出力され、追加合計額の値が「30,000」として表示されていること（collect_cash_info の total_amount と同一のカンマ区切り形式）。
 * 
 * ---
 * ### テスト方法/シナリオ
 * | Step | 手順 | エンドポイント |
 * | :-: | :--- | :--- |
 * | - | 該当のAPIが見当たらない？ | - |
 * | 1 | - | `/cash/in` |
 * 
 * ---
 * ### 前提条件
 * * 特になし
 * 
 * ---
 * ### テストデータ
 * * Request データ
 * * 1.cash_in_type: 2
 * * 2.cash_info:
 * * * \+ total_amount: 30000
 * * * \+ cash_type: 7
 * * * \+ amount: 30
 * 
 * ---
 * ### 期待結果
 * * #### 1. `/cash/in` （cash_in_type = 2：POS釣銭機への入金）
 * * \- レシートデータに以下の情報が含まれていることを確認
 * * *  ・「追加合計額」
 * * *  ・「30,000」（collect_cash_info の total_amount と同じカンマ区切り形式）
 * * *  ・「釣銭準備金」
 * * \- レシートに出力される金額がテストデータの合計金額以上であること（カンマ区切り形式）
 */
export function TC_041025001_CashIn() {
  group("TC_041025001 釣銭追加の動き", () => {
    const step = {
      cashIn: CommonFunction.getFullDesc(ENDPOINT.CASH_IN),
    };

    const cashInType = 2; // Test data. 投入種別 (2: 釣銭追加)
    const cashInInfo = {
      total_amount: 30000, // Test data. Equals 1000円 * 30
      cash_details: [
        {
          cash_type: CASH_TYPE.BILL1000.TYPE,
          count: 30, // Test data
        },
      ],
    };

    TestHelper.cashIn(step.cashIn, {
      cashInInfo,
      cashInType,
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify receipt data must contain information cash in",
        expected: true,
        actual: (res) => {
          const stringTotalAmount = CommonFunction.convertToCurrency(cashInInfo.total_amount);
          return CommonFunction.checkReceiptData([
            "追加合計額",
            stringTotalAmount,
            "釣銭準備金",
          ], res.result?.receipts);
        },
      }),
      CHECK.createEqualsCheck({
        name: "Verify receipt data has an amount greater than or equal to the cash in amount",
        expected: true,
        actual: (res) => {
          const receipt = res.result?.receipts?.find(q => q.receipt_data?.includes("釣銭準備金"));
          const reserveAmount = CommonFunction.extractAmountAfterKeyword(receipt?.receipt_data, "釣銭準備金");
          return reserveAmount >= cashInInfo.total_amount;
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
