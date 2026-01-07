import { group, sleep } from "k6";
import * as CHECK from "../../../common/common_check.js";
import * as ENDPOINT from "../../../common/endpoint_const.js";
import * as PROD from "../../../common/constant/product.js";
import * as ENVIRONMENT from "../../../common/environment_const.js";
import { PAID_METHOD } from "../../../common/constant/paid_methods.js";
import { CommonFunction } from "../../../common/common_function.js";
import { TestHelper } from "../../../common/test_helper.js";
import { CARD } from "../../../common/constant/card.js";
import { COUPON } from "../../../common/constant/coupon.js";
import * as TAGS from "../../../tags/tags_const.js";

/**
 * @function クスリのアオキ ギフトカード払い
 * @memberof 返品
 * @description
 * {@link TAGS.POS}
 * {@link TAGS.RETURN}
 * {@link TAGS.SETTLEMENT}
 * {@link TAGS.TRADE_CALL}
 * {@link TAGS.TMN_PREPAID}
 * {@link TAGS.RETURN_OF_ENTIRE_TRANSACTION_RETURN_OF_ENTIRE_RECEIPT}
 * {@link TAGS.MEDICINAL_AOKI_GIFT_CARD}
 * ### テスト観点
 * * 前提：
 * * テスト観点：
 * * クスリのアオキ ギフトカードで支払った売上取引が返品できる。
 * 
 * ---
 * ### テスト方法/シナリオ
 * | Step | 手順 | エンドポイント |
 * | :-: | :--- | :--- |
 * | 0 | Aokiギフトカードの金額が支払可能にする | - |
 * | 1 | 取引開始 | `/sales/begin` |
 * | 2 | ポイント付与専用商品（対象外） スキャン | `/sales/cart/barcode` |
 * | 3 | 通常商品 スキャン | `/sales/cart/barcode` |
 * | 4 | 小計 | `/sales/subtotal` |
 * | 5 | 支払登録 | `/tmn-prepaid/value` |
 * | 6 | 支払登録 | `/sales/cart/voucher` |
 * | 7 | 支払登録 | `/sales/addpayment` |
 * | 8 | 取引完了 | `/sales/end` |
 * | 9 | 【返品】取引開始 | `/refund/begin` |
 * | 10 | 【返品】小計 | `/refund/subtotal` |
 * | 11 | 【返品】支払登録 | `/tmn-prepaid/refund` |
 * | 12 | 【返品】支払登録 | `/refund/cart/voucher` |
 * | 13 | 【返品】支払登録 | `/refund/addpayment` |
 * | 14 | 【返品】取引完了 | `/refund/end` |
 * 
 * ---
 * ### 前提条件
 * * 販売取引はテストの観点に基づき、TC_061で検証済み。 
 * 
 * ---
 * ### テストデータ
 * * 1.ポイント付与専用商品（対象外）: 4911110703005
 * * 2.通常商品 : 4500000000121
 * * 3.くすりのアオキ ギフトカード: 8308891100000030 (paid_code: 0996)
 * * 4.ビール・清酒券
 * * * \+ voucher_code: "0611"
 * 
 * ---
 * ### 期待結果
 * * #### 4. 小計 `/sales/subtotal`
 * * \- sales.cartinfoデータを取得する（TC_061で実施する）。
 * * #### 5. 支払登録 `/tmn-prepaid/value`
 * * \- aoki_payment = sales.payments[] データを取得する（アオキギフトカード）。
 * * #### 6. 支払登録 `/sales/cart/voucher`
 * * \- beer_voucher_payment = sales.payments[] データを取得する（ビール・清酒券）。
 * * #### 7. 支払登録 `/sales/addpayment`
 * * \- cash_payment = sales.payments[] データを取得する（現金）。
 * * #### 10. 【返品】小計 `/refund/subtotal`
 * * \- 合計金額が販売取引の金額と一致していることを確認する。
 * * * \+ total_balance_amount = sales.cartinfo.total_balance_amount
 * * #### 11. 【返品】支払登録 `/tmn-prepaid/refund`
 * * \- 返金金額が販売取引の金額と一致していることを確認する。
 * * * \+ void_payments にギフト（アオキギフトカード）支払が含まれる：
 * * * * ・void_payments[].paid_cd = aoki_payment.paid_cd  
 * * * * ・void_payments[].paid_name = aoki_payment.paid_name  
 * * * * ・void_payments[].paid_amount = aoki_payment.paid_amount  
 * * #### 12. 【返品】支払登録 `/refund/cart/voucher`
 * * \- 返金金額が販売取引の金額と一致していることを確認する。
 * * * \+ void_payments に金券（ビール・清酒券）支払が含まれる：
 * * * * ・void_payments[].paid_cd = beer_voucher_payment.paid_cd  
 * * * * ・void_payments[].paid_name = beer_voucher_payment.paid_name  
 * * * * ・void_payments[].paid_amount = beer_voucher_payment.paid_amount  
 * * #### 13. 【返品】支払登録 `/refund/addpayment`
 * * \- 返金金額が販売取引の金額と一致していることを確認する。
 * * * \+ void_payments に現金支払が含まれる：
 * * * * ・void_payments[].paid_cd = cash_payment.paid_cd  
 * * * * ・void_payments[].paid_name = cash_payment.paid_name  
 * * * * ・void_payments[].paid_amount = cash_payment.paid_amount  
 * * \- 返品後の合計金額が0であることを確認する。
 * * * \+ total_balance_amount = 0
 * * #### 14. 【返品】取引完了 `/refund/end`
 * * \- レシートに以下の情報が含まれていることを確認する：
 * * * "ギフト", "ビール・清酒券", "現金", "ご返金"  
 * * \- 返金金額が販売取引と一致していることを確認する。
 */
export function TC_021909001_AokiGiftCardPayment() {
  group("TC_021909001 クスリのアオキ ギフトカード払い", () => {
    const preStep = {
      certification: CommonFunction.getFullDesc(ENDPOINT.TMN_PREPAID_CERTIFICATION),
      getBalance: CommonFunction.getFullDesc(ENDPOINT.TMN_PREPAID_GET_BALANCE),
      deposit: CommonFunction.getFullDesc(ENDPOINT.TMN_PREPAID_DEPOSIT),
    };

    const step = {
      begin: CommonFunction.getFullDesc(ENDPOINT.SALES_BEGIN),
      barcodeDedicatedPointGrantExclude: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "ポイント付与専用商品（対象外） スキャン"),
      barcodeRegular: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "通常商品 スキャン"),
      subtotal: CommonFunction.getFullDesc(ENDPOINT.SALES_SUBTOTAL),
      tmnPrepaidValue: CommonFunction.getFullDesc(ENDPOINT.TMN_PREPAID_VALUE, `${ENDPOINT.TMN_PREPAID_VALUE.desc} (Aoki gift card)`),
      voucher: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_VOUCHER, `${ENDPOINT.SALES_CART_VOUCHER.desc} (Beer voucher)`),
      payment: CommonFunction.getFullDesc(ENDPOINT.SALES_ADDPAYMENT, `${ENDPOINT.SALES_ADDPAYMENT.desc} (Cash)`),
      end: CommonFunction.getFullDesc(ENDPOINT.SALES_END),
      refundBegin: CommonFunction.getFullDesc(ENDPOINT.REFUND_BEGIN),
      refundSubtotal: CommonFunction.getFullDesc(ENDPOINT.REFUND_SUBTOTAL),
      refundTmnPrepaid: CommonFunction.getFullDesc(ENDPOINT.TMN_PREPAID_REFUND, `${ENDPOINT.TMN_PREPAID_REFUND.desc} (Aoki gift card)`),
      refundVoucher: CommonFunction.getFullDesc(ENDPOINT.REFUND_CART_VOUCHER, `${ENDPOINT.REFUND_CART_VOUCHER.desc} (Beer voucher)`),
      refundPayment: CommonFunction.getFullDesc(ENDPOINT.REFUND_PAYMENT, `${ENDPOINT.REFUND_PAYMENT.desc} (Cash)`),
      refundEnd: CommonFunction.getFullDesc(ENDPOINT.REFUND_END),
    };

    const cardNo = CARD.AOKI_GIFT.CODE;
    // Test data
    const voucherAmount = 2000;
    const cashAmount = 1000;

    let cartNo = TestHelper.salesBegin(step.begin, {
      operateEmployeeCd: ENVIRONMENT.EMPLOYEE_CD,
      isSelf: false,
      terminalId: ENVIRONMENT.TERMINAL_ID,
    }, [
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

    const aokiAmount = salesCartInfo?.total_sales_amount - cashAmount - voucherAmount;

    TestHelper.tmnPrepaidCertification(preStep.certification, [
      CHECK.createStatusCodeCheck(),
    ]);

    const balance = TestHelper.tmnPrepaidGetBalance(preStep.getBalance, {
      cardNo,
    }, [
      CHECK.createStatusCodeCheck(),
    ]).result?.card_info?.value_amount_sum;

    if (balance < aokiAmount) {
      TestHelper.tmnPrepaidDeposit(preStep.deposit, {
        cardNo,
        receiptNo: ENVIRONMENT.TMN_PREPAID_RECEIPT_NO,
        chargeValueAmount: aokiAmount,
      }, [
        CHECK.createStatusCodeCheck(),
      ]);
    }

    TestHelper.tmnPrepaidValue(step.tmnPrepaidValue, {
      cartNo,
      paidCodes: [
        PAID_METHOD.TMN_PREPAID.PAID_ITEMS.TMN_PREPAID_GIFT_CARD.PAID_CODE,
      ],
      paidAmount: aokiAmount,
      cardNo,
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    TestHelper.salesCartVoucher(step.voucher, {
      cartNo,
      voucherCode: COUPON.BEER_VOUCHER.CD,
      voucherBalanceAmount: voucherAmount,
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    const salesPayments = TestHelper.salesAddPayment(step.payment, {
      cartNo,
      paidGroupCode: PAID_METHOD.CASH.GROUP_CODE,
      paidCode: PAID_METHOD.CASH.PAID_ITEMS.DRAWER.PAID_CODE,
      totalBalanceAmount: cashAmount,
    }, [
      CHECK.createStatusCodeCheck(),
    ]).result?.cartinfo?.payments;

    const aokiPayment = salesPayments?.find(p => p.paid_cd === PAID_METHOD.TMN_PREPAID.PAID_ITEMS.TMN_PREPAID_GIFT_CARD.PAID_CODE);
    const beerVoucherPayment = salesPayments?.find(p => p.paid_cd === COUPON.BEER_VOUCHER.CD);
    const cashPayment = salesPayments?.find(p => p.paid_cd === PAID_METHOD.CASH.PAID_ITEMS.DRAWER.PAID_CODE);

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

    const refundCartInfo  = TestHelper.refundBegin(step.refundBegin, {
      receiptBarcode,
      operateEmployeeCd: ENVIRONMENT.EMPLOYEE_CD,
    }, [
      CHECK.createStatusCodeCheck(),
    ]).result?.cartinfo;

    cartNo = refundCartInfo?.cart_no;
    const payment = refundCartInfo?.payments?.find(p => p.paid_cd === PAID_METHOD.CASH.PAID_ITEMS.DRAWER.PAID_CODE);

    const totalPaidAmount = TestHelper.refundSubtotal(step.refundSubtotal, {
      cartNo,
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify total amount equal the amount in sales transaction",
        expected: salesCartInfo?.total_balance_amount,
        actual: (res) => res.result?.cartinfo?.total_balance_amount,
      }),
    ]).result?.cartinfo?.total_balance_amount;

    TestHelper.tmnPrepaidRefund(step.refundTmnPrepaid, {
      cartNo,
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify void payments contains ギフト (Aoki gift card) payment",
        expected: {
          paidCd: aokiPayment?.paid_cd,
          paidName: aokiPayment?.paid_name,
          paidAmount: aokiPayment?.paid_amount,
        },
        actual: (res) => {
          const aokiVoidPayment = res.result?.cartinfo?.void_payments?.find(p => p.paid_cd === PAID_METHOD.TMN_PREPAID.PAID_ITEMS.TMN_PREPAID_GIFT_CARD.PAID_CODE);
          return {
            paidCd: aokiVoidPayment?.paid_cd,
            paidName: aokiVoidPayment?.paid_name,
            paidAmount: aokiVoidPayment?.paid_amount,
          };
        },
      }),
    ]);

    const refundRemainAmount = TestHelper.refundCartVoucher(step.refundVoucher, {
      cartNo,
      voucherCode: COUPON.BEER_VOUCHER.CD,
      voucherBalanceAmount: voucherAmount,
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify void payments contains 金券 (Beer voucher) payment",
        expected: {
          paidCd: beerVoucherPayment?.paid_cd,
          paidName: beerVoucherPayment?.paid_name,
          paidAmount: beerVoucherPayment?.paid_amount,
        },
        actual: (res) => {
          const beerVoucherVoidPayment = res.result?.cartinfo?.void_payments?.find(p => p.paid_cd === COUPON.BEER_VOUCHER.CD);
          return {
            paidCd: beerVoucherVoidPayment?.paid_cd,
            paidName: beerVoucherVoidPayment?.paid_name,
            paidAmount: beerVoucherVoidPayment?.paid_amount,
          };
        },
      }),
    ]).result?.cartinfo?.total_balance_amount;

    TestHelper.refundPayment(step.refundPayment, {
      cartNo,
      paidGroupCode: payment?.paid_group_cd,
      paidCode: payment?.paid_cd,
      paidAmount: refundRemainAmount,
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify void payments contains 現金 (Cash) payment",
        expected: {
          paidCd: cashPayment?.paid_cd,
          paidName: cashPayment?.paid_name,
          paidAmount: cashPayment?.paid_amount,
        },
        actual: (res) => {
          const cashVoidPayment = res.result?.cartinfo?.void_payments?.find(p => p.paid_cd === PAID_METHOD.CASH.PAID_ITEMS.DRAWER.PAID_CODE);
          return {
            paidCd: cashVoidPayment?.paid_cd,
            paidName: cashVoidPayment?.paid_name,
            paidAmount: cashVoidPayment?.paid_amount,
          };
        },
      }),
      CHECK.createEqualsCheck({
        name: "Verify total balance amount",
        expected: 0,
        actual: (res) => res.result?.cartinfo?.total_balance_amount,
      }),
    ]);

    TestHelper.refundEnd(step.refundEnd, {
      cartNo,
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify receipt data must contain information: ギフト, ビール・清酒券, 現金, ご返金 and refund amount is equal sales transaction",
        expected: true,
        actual: (res) => {
          const stringTotalPaidAmount = CommonFunction.convertToCurrency(totalPaidAmount);
          return CommonFunction.includesItems([
            PAID_METHOD.TMN_PREPAID.PAID_ITEMS.TMN_PREPAID_GIFT_CARD.PAID_NAME,
            COUPON.BEER_VOUCHER.NAME,
            PAID_METHOD.CASH.PAID_ITEMS.DRAWER.PAID_NAME,
            "ご返金",
            stringTotalPaidAmount,
          ], res.result?.receipts?.[0]?.receipt_data);
        },
      }),
    ]);
  });
}
