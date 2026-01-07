import { group, sleep } from "k6";
import * as CHECK from "../../../common/common_check.js";
import * as ENDPOINT from "../../../common/endpoint_const.js";
import * as ENVIRONMENT from "../../../common/environment_const.js";
import { PAID_METHOD } from "../../../common/constant/paid_methods.js";
import { CARD } from "../../../common/constant/card.js";
import { TestHelper } from "../../../common/test_helper.js";
import { CommonFunction } from "../../../common/common_function.js";
import * as TAGS from "../../../tags/tags_const.js";

/**
 * @function TMNプリペのチャージ～誤打訂正の一連動作
 * @memberof 誤打訂正.売上業務
 * @description
 * {@link TAGS.POS}
 * {@link TAGS.MISPRINT_CORRECTION}
 * {@link TAGS.SETTLEMENT}
 * {@link TAGS.SALES_OPERATIONS}
 * {@link TAGS.TMN_PREPAID}
 * {@link TAGS.TRADE_CALL}
 * {@link TAGS.CHARGE_CANCELLATION}
 * {@link TAGS.BARCODE_SCAN}
 * ### テスト観点
 * * クスリのアオキプリペイドカードをチャージした後に、誤打訂正にてチャージの取消ができる。
 * * * ・クスリのアオキプリペイドカードを5000円チャージする
 * * * ・チャージ完了後に、誤打訂正を行う。
 * * * * →　クスリのアオキプリペイドカードチャージ取引のレシートをスキャンする
 * 
 * ---
 * ### テスト方法/シナリオ
 * | Step | 手順 | エンドポイント |
 * | :-: | :--- | :--- |
 * | 0 | AOKカードの金額が上限値に達した場合、金額を0に設定する必要 | - |
 * | 1 | TMNプリペチャージ開始 | `/tmn-prepaid/charge/begin` |
 * | 2 | TMNプリペチャージ実行 | `/tmn-prepaid/charge` |
 * | 3 | 【誤打訂正】取引開始 | `/void/begin` |
 * | 4 | 【誤打訂正】TMNプリぺチャージ | `/void/tmn-prepaid/charge` |
 * | 5 | 認証 | `/tpi_v1/terminal/generatekey` |
 * | 6 | 残高照会 | `/tpi_v1/holder/getbalance` |
 * 
 * ---
 * ### 前提条件
 * * 特になし
 * 
 * ---
 * ### テストデータ
 * * 1. クスリのアオキプリペイドカード: 8090227000000006
 * * 2. charge_amount: 5000
 * * 3. end_date_time: "2023-08-15"
 * 
 * ---
 * ### 期待結果
 * * #### 1. TMNプリペチャージ開始 `/tmn-prepaid/charge/begin`
 * * \- original_amount = customer.value_amount_sum を取得
 * * #### 2. TMNプリペチャージ実行 `/tmn-prepaid/charge`
 * * \- チャージ金額分、カード残高が増加していることを確認
 * * * \+ value_amount_sum = original_amount + charge_amount
 * * \- チャージレシートにチャージ金額が含まれていることを確認
 * * #### 4. 【誤打訂正】TMNプリペチャージ `/void/tmn-prepaid/charge`
 * * \- 誤打訂正レシートにチャージ金額が含まれていることを確認
 * * #### 6. 残高照会 `/tpi_v1/holder/getbalance`
 * * \- 残高が元の金額にロールバックされていることを確認
 * * * \+ value_amount_sum = original_amount
 */
export function TC_040224001_VoidTMNCharge() {
  group("TC_040224001 TMNプリペのチャージ～誤打訂正の一連動作", () => {
    const preStep = {
      generateKey: CommonFunction.getFullDesc(ENDPOINT.TMN_PREPAID_CERTIFICATION, "Precondition 認証"),
      getBalance: CommonFunction.getFullDesc(ENDPOINT.TMN_PREPAID_GET_BALANCE, "Precondition 残高照会"),
      settlementPayment: CommonFunction.getFullDesc(ENDPOINT.SETTLEMENT_PAYMENT, "Precondition バリュー利用"),
    };

    const step = {
      tmnPrepaidChargeBegin: CommonFunction.getFullDesc(ENDPOINT.TMN_PREPAID_CHARGE_BEGIN),
      tmnPrepaidCharge: CommonFunction.getFullDesc(ENDPOINT.TMN_PREPAID_CHARGE),
      voidBegin: CommonFunction.getFullDesc(ENDPOINT.VOID_BEGIN),
      voidTmnPrepaidCharge: CommonFunction.getFullDesc(ENDPOINT.VOID_TMN_PREPAID_CHARGE),
      generateKey: CommonFunction.getFullDesc(ENDPOINT.TMN_PREPAID_CERTIFICATION),
      getBalance: CommonFunction.getFullDesc(ENDPOINT.TMN_PREPAID_GET_BALANCE),
    };

    const cardNo = CARD.AOKI_PREPAID_POINT.CODE;
    const cardType = CARD.AOKI_PREPAID.CARD_TYPE; // カード種別: Aoca. Specified in API document
    const chargeAmount = 5000; // Test data
    const endDatetime = "2023-08-15"; // Test data

    TestHelper.tmnPrepaidCertification(preStep.generateKey, [
      CHECK.createStatusCodeCheck(),
    ]);

    const cardInfo = TestHelper.tmnPrepaidGetBalance(preStep.getBalance, {
      cardNo,
    }, [
      CHECK.createStatusCodeCheck(),
    ]).result?.card_info;

    // Set the AOK card amount to 0 if it reaches the ceiling value
    if (cardInfo.value_amount_sum + chargeAmount >= cardInfo.ceiling_value_amount) {
      TestHelper.settlementPayment(preStep.settlementPayment, {
        cardNo,
        usageValueAmount: cardInfo.value_amount_sum,
      }, [
        CHECK.createStatusCodeCheck(),
      ]);
    }

    const originalAmount = TestHelper.tmnPrepaidChargeBegin(step.tmnPrepaidChargeBegin, {
      cardNo,
      cardType,
    }, [
      CHECK.createStatusCodeCheck(),
    ]).result?.customer?.value_amount_sum;

    const chargeInfo = TestHelper.tmnPrepaidCharge(step.tmnPrepaidCharge, {
      cardNo,
      paidGroupCode: PAID_METHOD.CASH.GROUP_CODE,
      paidCode: PAID_METHOD.CASH.PAID_ITEMS.AUTOMATIC_CHANGE_MACHINE.PAID_CODE,
      chargeAmount,
      endDatetime,
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify the amount of card increase by charge amount",
        expected: originalAmount + chargeAmount,
        actual: (res) => res.result?.charge_info?.customer?.value_amount_sum,
      }),
      CHECK.createEqualsCheck({
        name: "Verify charge receipt data must contain charge amount",
        expected: true,
        actual: (res) => {
          const stringChargeAmount = CommonFunction.convertToCurrency(chargeAmount);
          return CommonFunction.checkReceiptData([
            stringChargeAmount,
          ], res.result?.receipts);
        },
      }),
    ]).result?.charge_info;

    sleep(3);

    const receiptNoCharge = chargeInfo?.receipt_no;
    const businessDay = chargeInfo?.business_day.substring(0, 10);

    const receiptBarcode = CommonFunction.getReceiptBarcode({
      receiptNo: receiptNoCharge,
      businessDay,
      barcodeStart: ENVIRONMENT.CHARGE_RECEIPT_BARCODE_START,
    });

    TestHelper.voidBegin(step.voidBegin, {
      receiptBarcode,
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    TestHelper.voidTmnPrepaidCharge(step.voidTmnPrepaidCharge, {
      receiptBarcode,
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify void receipt data must contain charge amount",
        expected: true,
        actual: (res) => {
          const stringChargeAmount = CommonFunction.convertToCurrency(chargeAmount);
          return CommonFunction.checkReceiptData([
            stringChargeAmount,
          ], res.result?.receipts);
        },
      }),
    ]);

    TestHelper.tmnPrepaidCertification(step.generateKey, [
      CHECK.createStatusCodeCheck(),
    ]);

    TestHelper.tmnPrepaidGetBalance(step.getBalance, {
      cardNo,
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify the amount rollback to original amount",
        expected: originalAmount,
        actual: (res) => res.result?.card_info?.value_amount_sum,
      }),
    ]);
  });
}