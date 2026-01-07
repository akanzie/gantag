import { group } from "k6";
import * as CHECK from "../../../common/common_check.js";
import * as ENDPOINT from "../../../common/endpoint_const.js";
import { TestHelper } from "../../../common/test_helper.js";
import { CommonFunction } from "../../../common/common_function.js";
import * as TAGS from "../../../tags/tags_const.js";

/**
 * @function 両替の動き
 * @memberof 金銭管理.両替
 * @description
 * {@link TAGS.POS}
 * {@link TAGS.MONEY_MANAGEMENT}
 * {@link TAGS.MONEY_EXCHANGE}
 * ### テスト観点
 * * 金種別に枚数を入力して両替の入力ができる。
 * * * ・50,000円を千円札に両替する。
 * * * * →　金種：10,000円　両替前を10枚、両替後を5枚
 * * * * 金種：1,000円　  両替前を10枚、両替後を60枚
 * * * ・テスト観点：
 * * * \+ レシートデータに"両替"の文字列があるか確認
 * * * \+ レシートデータに金額を確認
 * * * \+ business_dayが空でないか確認
 * 
 * ---
 * ### テスト方法/シナリオ
 * | Step | 手順 | エンドポイント |
 * | :-: | :--- | :--- |
 * | 1 | 両替 | `/cash/exchange` |
 * 
 * ---
 * ### 前提条件
 * * 特になし
 * 
 * ---
 * ### テストデータ
 * * リクエストデータ:
 * * 1. exchange_amount = 0 より大きい値
 * * 2. type = 2
 * 
 * ---
 * ### 期待結果
 * * #### 1.両替 `/cash/exchange`
 * * \- レシートデータには、"両替"およびテストデータ内の exchange_amount（カンマ区切り形式） が含まれていることを確認すること。
 * * \- business_day が空でないこと を確認すること
 */
export function TC_041545001_CashExchange() {
  group("TC_041545001 両替の動き", () => {
    const step = {
      cashExchange: CommonFunction.getFullDesc(ENDPOINT.CASH_EXCHANGE),
    };

    const exchangeAmount = 50000; // Test data
    const type = 2; // Test data. 両替種別（1:お客様由来、2:店舗由来）

    TestHelper.cashExchange(step.cashExchange, {
      exchangeAmount,
      type,
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify receipt data must contain information 両替 and exchange amount",
        expected: true,
        actual: (res) => {
          const stringExchangeAmount = CommonFunction.convertToCurrency(exchangeAmount);
          return CommonFunction.includesItems([
            "両替",
            stringExchangeAmount,
          ], res.result?.receipts?.[0]?.receipt_data);
        },
      }),
      CHECK.createEqualsCheck({
        name: "Verify business day must be a valid date",
        expected: true,
        actual: (res) => CommonFunction.isValidDate(res.result?.business_day?.split("T")?.[0]),
      }),
    ]);
  });
}
