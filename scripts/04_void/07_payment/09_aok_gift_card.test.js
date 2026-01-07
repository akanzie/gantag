import * as CHECK from "../../../common/common_check.js";
import * as ENDPOINT from "../../../common/endpoint_const.js";
import * as PROD from "../../../common/constant/product.js";
import * as ENVIRONMENT from "../../../common/environment_const.js";
import { group, sleep } from "k6";
import { CommonFunction } from "../../../common/common_function.js";
import { TestHelper } from "../../../common/test_helper.js";
import { PAID_METHOD } from "../../../common/constant/paid_methods.js";
import { CARD } from "../../../common/constant/card.js";
import * as TAGS from "../../../tags/tags_const.js";

/**
 * @function クスリのアオキ ギフトカード払い
 * @memberof 誤打訂正
 * @description
 * {@link TAGS.POS}
 * {@link TAGS.MISPRINT_CORRECTION}
 * {@link TAGS.PAYMENT}
 * {@link TAGS.TMN_PREPAID}
 * {@link TAGS.DRUG_AOKI_GIFT_TEA_CARD}
 * ### テスト観点
 * * クスリのアオキギフトカードの売上を実施して、の誤打訂正を行う。
 * * テスト観点：
 * * クスリのアオキ ギフトカードで支払った売上取引が誤打訂正により取消ができる。
 * 
 * ---
 * ### テスト方法/シナリオ
 * | Step | 手順 | エンドポイント |
 * | :-: | :--- | :--- |
 * | 0 | Aokiギフトカードが支払可能な金額に設定 | - |
 * | 1 | 取引開始 | `/sales/begin` |
 * | 2 | ポイント付与専用商品（対象外）スキャン | `/sales/cart/barcode` |
 * | 3 | 通常商品スキャン | `/sales/cart/barcode` |
 * | 4 | 小計 | `/sales/subtotal` |
 * | 5 | 支払登録 | `/tmn-prepaid/value` |
 * | 6 | 取引完了 | `/sales/end` |
 * | 7 | 【誤打訂正】取引開始 | `/void/begin` |
 * | 8 | TMNプリペバリュー返金 | `/tmn-prepaid/refund` |
 * | 9 | 【誤打訂正】取引終了 | `/void/end` |
 * 
 * ---
 * ### 前提条件
 * * 販売取引はテストの観点に基づき、TC_061で検証済み。 
 * 
 * ---
 * ### テストデータ
 * * 1. ポイント付与専用商品（対象外）: 4911110703005
 * * 2. 通常商品 : 4500000000121
 * * 3. クスリのアオキ ギフトカード: 8308891100000030 (paid_code: 0996)
 * 
 * ---
 * ### 期待結果
 * * * データ取得（販売取引 TC_061でテスト済み）
 * * #### 4. 小計 `/sales/subtotal`
 * * \- データ取得：sales.cartinfo
 * * * TMNプリペバリュー支払いの確認
 * * #### 5. 支払登録 `/tmn-prepaid/value`
 * * \- 支払い後の残高合計金額が0であることを確認
 * * * \+ total_balance_amount: 0
 * * \- カート情報にTMNプリペバリュー支払いが含まれていることを確認
 * * * \+ tmn_prepaid に以下が含まれること：
 * * * * \.paid_cd = "0996"
 * * * * \.paid_name = "ギフト"
 * * * * \.paid_amount = sales.cartinfo.total_balance_amount
 * *  * 誤打訂正データが販売取引と一致していることを確認
 * * #### 7.【誤打訂正】取引開始 `/void/begin`
 * * \- 合計金額が販売取引と同じであることを確認
 * * * \+ total_balance_amount = sales.cartinfo.total_balance_amount
 * * #### 8. TMNプリペバリュー返金 `/tmn-prepaid/refund`
 * * \- 返金金額が販売取引と同じであることを確認
 * * * \+ void_payments に TMNプリペバリュー支払いが含まれること
 * * * * \. void_payments[].paid_cd = tmn_prepaid.paid_cd
 * * * * \. void_payments[].paid_name = tmn_prepaid.paid_name
 * * * * \. void_payments[].paid_amount = tmn_prepaid.paid_amount
 * * \- 返金後の残高合計金額が0であることを確認
 * * * \+ total_balance_amount = 0
 * * #### 9.【誤打訂正】取引終了 `/void/end`
 * * \- レシートに「ギフト」「誤打訂正」が含まれ、返金金額が販売取引と一致していることを確認
 */
export function TC_040709001_VoidAokiGiftCardPayment() {
  group("TC_040709001 クスリのアオキ ギフトカード払い", () => {
    const preStep = {
      generatekey: CommonFunction.getFullDesc(ENDPOINT.TMN_PREPAID_CERTIFICATION),
      getBalance: CommonFunction.getFullDesc(ENDPOINT.TMN_PREPAID_GET_BALANCE),
      deposit: CommonFunction.getFullDesc(ENDPOINT.TMN_PREPAID_DEPOSIT),
    };

    const step = {
      begin: CommonFunction.getFullDesc(ENDPOINT.SALES_BEGIN),
      barcodeDedicatedPointGrantExclude: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "ポイント付与専用商品（対象外）スキャン"),
      barcodeRegular: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "通常商品スキャン"),
      subtotal: CommonFunction.getFullDesc(ENDPOINT.SALES_SUBTOTAL),
      tmnPrepaidValue: CommonFunction.getFullDesc(ENDPOINT.TMN_PREPAID_VALUE),
      end: CommonFunction.getFullDesc(ENDPOINT.SALES_END),
      voidBegin: CommonFunction.getFullDesc(ENDPOINT.VOID_BEGIN),
      tmnPrepaidRefund: CommonFunction.getFullDesc(ENDPOINT.TMN_PREPAID_REFUND),
      voidEnd: CommonFunction.getFullDesc(ENDPOINT.VOID_END),
    };

    let aokiPayment = null;

    let cartNo = TestHelper.salesBegin(step.begin, {}, [
      CHECK.createStatusCodeCheck(),
    ]);

    TestHelper.salesCartBarcode(step.barcodeDedicatedPointGrantExclude, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.DEDICATED_POINT_GRANT_EXCLUDE,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    TestHelper.salesCartBarcode(step.barcodeRegular, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.REGULAR,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    const salesCartInfo = TestHelper.salesSubtotal(step.subtotal, cartNo, [
      CHECK.createStatusCodeCheck(),
    ]).result?.cartinfo;

    TestHelper.tmnPrepaidCertification(preStep.generatekey, [
      CHECK.createStatusCodeCheck(),
    ]);

    // Ensure the amount can be paid by Aoki gift card
    const balance = TestHelper.tmnPrepaidGetBalance(preStep.getBalance, {
      cardNo: CARD.AOKI_GIFT.CODE,
    }, [
      CHECK.createStatusCodeCheck(),
    ]).result?.card_info?.value_amount_sum;

    if (balance < salesCartInfo.total_balance_amount) {
      TestHelper.tmnPrepaidDeposit(preStep.deposit, {
        cardNo: CARD.AOKI_GIFT.CODE,
        receiptNo: ENVIRONMENT.TMN_PREPAID_RECEIPT_NO,
        chargeValueAmount: salesCartInfo.total_balance_amount,
      }, [
        CHECK.createStatusCodeCheck(),
      ]);
    }

    TestHelper.tmnPrepaidValue(step.tmnPrepaidValue, {
      cartNo,
      paidCodes: [
        PAID_METHOD.TMN_PREPAID.PAID_ITEMS.TMN_PREPAID_GIFT_CARD.PAID_CODE,
      ],
      paidAmount: salesCartInfo?.total_balance_amount,
      cardNo: CARD.AOKI_GIFT.CODE,
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify total balance amount equals 0 after payment",
        expected: 0,
        actual: (res) => res.result?.cartinfo?.total_balance_amount,
      }),
      CHECK.createEqualsCheck({
        name: "Verify the cart info has TMN prepaid payment",
        expected: {
          paidCd: PAID_METHOD.TMN_PREPAID.PAID_ITEMS.TMN_PREPAID_GIFT_CARD.PAID_CODE,
          paidName: PAID_METHOD.TMN_PREPAID.PAID_ITEMS.TMN_PREPAID_GIFT_CARD.PAID_NAME,
          paidAmount: salesCartInfo?.total_balance_amount,
        },
        actual: (res) => {
          aokiPayment = res.result?.cartinfo?.payments?.find(q => q.paid_cd === PAID_METHOD.TMN_PREPAID.PAID_ITEMS.TMN_PREPAID_GIFT_CARD.PAID_CODE);
          return {
            paidCd: aokiPayment?.paid_cd,
            paidName: aokiPayment?.paid_name,
            paidAmount: aokiPayment?.paid_amount,
          };
        },
      }),
    ]);

    const salesEndResponse = TestHelper.salesEnd(step.end, {
      cartNo,
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    sleep(3);

    const salesReceiptNo = salesEndResponse.result?.receipt_no;
    const salesBusinessDay = salesEndResponse.result?.business_day;

    const receiptBarcode = CommonFunction.getReceiptBarcode({
      receiptNo: salesReceiptNo,
      businessDay: salesBusinessDay,
      barcodeStart: ENVIRONMENT.SALES_RECEIPT_BARCODE_START,
    });

    cartNo = TestHelper.voidBegin(step.voidBegin, {
      receiptBarcode,
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify total amount equal the amount in sales transaction",
        expected: salesCartInfo?.total_balance_amount,
        actual: (res) => res.result?.cartinfo?.total_balance_amount,
      }),
    ]).result?.cartinfo?.cart_no;

    const totalBalanceAmount = TestHelper.tmnPrepaidRefund(step.tmnPrepaidRefund, {
      cartNo,
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify the refund amount equal the amount in sales transaction",
        expected: {
          paidCd: aokiPayment?.paid_cd,
          paidName: aokiPayment?.paid_name,
          paidAmount: aokiPayment?.paid_amount,
        },
        actual: (res) => {
          const voidPayment = res.result?.cartinfo?.void_payments?.find(payment => payment.paid_cd === aokiPayment?.paid_cd);
          return {
            paidCd: voidPayment?.paid_cd,
            paidName: voidPayment?.paid_name,
            paidAmount: voidPayment?.paid_amount,
          };
        },
      }),
      CHECK.createEqualsCheck({
        name: "Verify the total balance amount equals 0 after refund",
        expected: 0,
        actual: (res) => res.result?.cartinfo?.total_balance_amount,
      }),
    ]).result?.cartinfo?.total_balance_amount;

    TestHelper.voidEnd(step.voidEnd, {
      cartNo,
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify receipt data must contain information: ギフト, 誤打訂正 and refund amount is equal sales transaction",
        expected: true,
        actual: (res) => {
          const stringTotalPaidAmount = CommonFunction.convertToCurrency(totalBalanceAmount);
          return CommonFunction.includesItems([
            PAID_METHOD.TMN_PREPAID.PAID_ITEMS.TMN_PREPAID_GIFT_CARD.PAID_NAME,
            "誤打訂正",
            stringTotalPaidAmount,
          ], res.result?.receipts?.[0]?.receipt_data);
        },
      }),
    ]);
  });
}
