import * as CHECK from "../../../common/common_check.js";
import * as ENDPOINT from "../../../common/endpoint_const.js";
import * as ENVIRONMENT from "../../../common/environment_const.js";
import { group, sleep } from "k6";
import * as PROD from "../../../common/constant/product.js";
import { PAID_METHOD } from "../../../common/constant/paid_methods.js";
import { CARD } from "../../../common/constant/card.js";
import { CommonFunction } from "../../../common/common_function.js";
import { TestHelper } from "../../../common/test_helper.js";
import { RECEIPT_TYPE } from "../../../common/constant/receipt_type.js";
import * as TAGS from "../../../tags/tags_const.js";

/**
 * @function アオキクーポン（超トク）の値引
 * @memberof 返品
 * @description
 * {@link TAGS.POS}
 * {@link TAGS.RETURN}
 * {@link TAGS.SALES}
 * {@link TAGS.TRADE_CALL}
 * {@link TAGS.SALES_PROMOTION_PLANNED_SALES}
 * {@link TAGS.RETURN_OF_ENTIRE_TRANSACTION_RETURN_OF_ENTIRE_RECEIPT}
 * {@link TAGS.USE_APP_COUPON}
 * ### テスト観点
 * * 前提：
 * * テスト観点：
 * * アオキクーポン（超トク）の売上取引を返品して、アオキクーポン（超トク）適用後の金額が返金される。
 * * * ・超トク対象商品とBは、販促_商品明細マスタに登録されている商品
 * * * * →　超トク対象商品：超トク対象
 * * * * 販促商品：販促
 * * * * * 超トク対象商品は2件とも値引が適用される。
 * * * * 販促商品は1件のみ値引が適用され、もう1件は値引されない（通常価格）。
 * * * ・非販促商品は、販促_商品明細マスタに登録されていない商品
 * * * * →　アオキクーポンとは関係ない商品で通常価格となる
 * 
 * ---
 * ### テスト方法/シナリオ
 * | Step | 手順 | エンドポイント |
 * | :-: | :--- | :--- |
 * | 1 | 取引開始 | `/sales/begin` |
 * | 2 | Aocaカードスキャン | `/sales/cart/barcode` |
 * | 3 | 超トク対象商品スキャン (1st) | `/sales/cart/barcode` |
 * | 4 | 超トク対象商品スキャン (2nd) | `/sales/cart/barcode` |
 * | 5 | 販促商品スキャン (1st) | `/sales/cart/barcode` |
 * | 6 | 販促商品スキャン (2nd) | `/sales/cart/barcode` |
 * | 7 | 非販促商品スキャン | `/sales/cart/barcode` |
 * | 8 | 小計 | `/sales/subtotal` |
 * | 9 | 支払登録 | `/sales/addpayment` |
 * | 10 | 取引完了 | `/sales/end` |
 * | 11 | 【返品】取引開始 | `/refund/begin` |
 * | 12 | 【返品】小計 | `/refund/subtotal` |
 * | 13 | 【返品】支払登録 | `/refund/addpayment` |
 * | 14 | 【返品】取引完了 | `/refund/end` |
 * 
 * ---
 * ### 前提条件
 * * 販売取引はテストの観点に基づき、TC_041で検証済み。 
 * 
 * ---
 * ### テストデータ
 * * 1.超トク対象商品 : 4500000000077  
 * * 2.販促商品 : 4911110703004  
 * * ※ 「テストデータ」シートに対応する製品：  
 * * \- 超トク対象商品 (PROD.super_bargain_2)
 * * 3.非販促商品 : 4500000000032  
 * * ※ 「テストデータ」シートに対応する製品：  
 * * \- 販促商品 (PROD.regular_promotion)
 * * 4.超得クーポン（即時利用）:  
 * * \- promotion_cd = 15604 & 15605
 * * 5.クスリのアオキプリペイドカード:  
 * * \- 8090227000000006 (Aokカード)
 * 
 * ---
 * ### 期待結果
 * * #### 8. 小計 `/sales/subtotal`
 * * \- sales.cartinfoデータを取得する（TC_041で実施する）。
 * * #### 9. 支払登録 `/sales/addpayment`
 * * \- 割引適用後の sales.payments[] データを取得する。
 * * #### 12.【返品】小計 `/refund/subtotal`
 * * \- 合計金額が販売取引の金額と一致していることを確認する。
 * * * \+ total_balance_amount = sales.cartinfo.total_balance_amount
 * * #### 13.【返品】支払登録 `/refund/addpayment`
 * * \- 返金金額が販売取引の金額と一致していることを確認する。
 * * * \+ void_payments は割引後の payment と一致していること。void_payments の内容：
 * * * * ・void_payments[].paid_cd = sales.payments[].paid_cd  
 * * * * ・void_payments[].paid_name = sales.payments[].paid_name  
 * * * * ・void_payments[].paid_amount = sales.payments[].paid_amount  
 * * \- 返品後の合計金額が0であることを確認する。
 * * * \+ total_balance_amount = 0
 * * #### 14.【返品】取引完了 `/refund/end`
 * * \- レシートデータに「ご返金」という情報が含まれ、返金金額が販売取引と一致していることを確認する。
 */
export function TC_021953001_RefundAokiCouponDiscountPattern() {
  group("TC_021953001 アオキクーポン（超トク）の値引", () => {
    const step = {
      begin: CommonFunction.getFullDesc(ENDPOINT.SALES_BEGIN),
      barcodeAokiPrepaid: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "Aocaカードスキャン"),
      barcodeSuperBargainScan1st: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "超トク対象商品スキャン (1st)"),
      barcodeSuperBargainScan2nd: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "超トク対象商品スキャン (2nd)"),
      barcodeSuperBargain2Scan1st: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "販促商品スキャン (1st)"),
      barcodeSuperBargain2Scan2nd: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "販促商品スキャン (2nd)"),
      barcodeRegularPromotion: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "非販促商品スキャン"),
      subtotal: CommonFunction.getFullDesc(ENDPOINT.SALES_SUBTOTAL),
      payment: CommonFunction.getFullDesc(ENDPOINT.SALES_ADDPAYMENT),
      end: CommonFunction.getFullDesc(ENDPOINT.SALES_END),
      refundBegin: CommonFunction.getFullDesc(ENDPOINT.REFUND_BEGIN),
      refundSubtotal: CommonFunction.getFullDesc(ENDPOINT.REFUND_SUBTOTAL),
      refundPayment: CommonFunction.getFullDesc(ENDPOINT.REFUND_PAYMENT),
      refundEnd: CommonFunction.getFullDesc(ENDPOINT.REFUND_END),
    };

    let cartNo = TestHelper.salesBegin(step.begin, {
      operateEmployeeCd: ENVIRONMENT.EMPLOYEE_BARCODE,
      isSelf: false,
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    TestHelper.salesCartBarcode(step.barcodeAokiPrepaid, {
      cartNo,
      barcodes: [
        {
          barcode: CARD.AOKI_PREPAID.CODE,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
    ], ENVIRONMENT.RETRY_TIMES);

    TestHelper.salesCartBarcode(step.barcodeSuperBargainScan1st, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.SUPER_BARGAIN,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    TestHelper.salesCartBarcode(step.barcodeSuperBargainScan2nd, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.SUPER_BARGAIN,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    TestHelper.salesCartBarcode(step.barcodeSuperBargain2Scan1st, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.SUPER_BARGAIN_2,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    TestHelper.salesCartBarcode(step.barcodeSuperBargain2Scan2nd, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.SUPER_BARGAIN_2,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    TestHelper.salesCartBarcode(step.barcodeRegularPromotion, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.REGULAR_PROMOTION,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    const salesCartInfo = TestHelper.salesSubtotal(step.subtotal, cartNo, [
      CHECK.createStatusCodeCheck(),
    ]).result?.cartinfo;

    const payments = TestHelper.salesAddPayment(step.payment, {
      cartNo,
      paidGroupCode: PAID_METHOD.QRCODE.GROUP_CODE,
      paidCode: PAID_METHOD.QRCODE.PAID_ITEMS.LINE_PAY.PAID_CODE,
      totalBalanceAmount: salesCartInfo?.total_balance_amount,
      details: ENVIRONMENT.LINEPAY_DETAIL,
    }, [
      CHECK.createStatusCodeCheck(),
    ]).result?.cartinfo?.payments;

    const paymentInfo = payments?.find(q => q.paid_cd == PAID_METHOD.QRCODE.PAID_ITEMS.LINE_PAY.PAID_CODE);

    const salesEndResponse = TestHelper.salesEnd(step.end, {
      cartNo,
      receiptType: RECEIPT_TYPE.NORMAL.VALUE,
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

    const refundCartInfo = TestHelper.refundBegin(step.refundBegin, {
      receiptBarcode,
      operateEmployeeCd: ENVIRONMENT.EMPLOYEE_BARCODE,
    }, [
      CHECK.createStatusCodeCheck(),
    ]).result?.cartinfo;

    cartNo = refundCartInfo?.cart_no;
    const payment = refundCartInfo?.payments?.find(p => p.paid_cd === PAID_METHOD.QRCODE.PAID_ITEMS.LINE_PAY.PAID_CODE);

    const totalBalanceAmount = TestHelper.refundSubtotal(step.refundSubtotal, {
      cartNo,
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify total amount equal the amount in sales transaction",
        expected: salesCartInfo?.total_balance_amount,
        actual: (res) => res.result?.cartinfo?.total_balance_amount,
      }),
    ]).result?.cartinfo?.total_balance_amount;

    TestHelper.refundPayment(step.refundPayment, {
      cartNo,
      paidGroupCode: payment?.paid_group_cd,
      paidCode: payment?.paid_cd,
      paidAmount: totalBalanceAmount,
      details: payment?.details,
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify the refund amount equal the amount in sales transaction",
        expected: {
          paidCd: paymentInfo?.paid_cd,
          paidName: paymentInfo?.paid_name,
          paidAmount: paymentInfo?.paid_amount,
        },
        actual: (res) => {
          const voidPayment = res.result?.cartinfo?.void_payments?.find(payment => payment.paid_cd === paymentInfo?.paid_cd);
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
    ]);

    TestHelper.refundEnd(step.refundEnd, {
      cartNo,
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify receipt data must contain information: ご返金 and refund amount is equal sales transaction",
        expected: true,
        actual: (res) => {
          const stringTotalPaidAmount = CommonFunction.convertToCurrency(totalBalanceAmount);
          return CommonFunction.includesItems([
            "ご返金",
            stringTotalPaidAmount,
          ], res.result?.receipts?.[0]?.receipt_data);
        },
      }),
    ]);
  });
}
