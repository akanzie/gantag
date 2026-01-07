import * as CHECK from "../../../common/common_check.js";
import * as ENDPOINT from "../../../common/endpoint_const.js";
import * as ENVIRONMENT from "../../../common/environment_const.js";
import { group, sleep } from "k6";
import * as PROD from "../../../common/constant/product.js";
import { PAID_METHOD } from "../../../common/constant/paid_methods.js";
import { COUPON } from "../../../common/constant/coupon.js";
import { CARD } from "../../../common/constant/card.js";
import { CommonFunction } from "../../../common/common_function.js";
import { TestHelper } from "../../../common/test_helper.js";
import { RECEIPT_TYPE } from "../../../common/constant/receipt_type.js";
import * as TAGS from "../../../tags/tags_const.js";

/**
 * @function エコ・子育てポイント付与の一連操作
 * @memberof 返品
 * @description
 * {@link TAGS.POS}
 * {@link TAGS.RETURN}
 * {@link TAGS.TRADE_CALL}
 * {@link TAGS.SALES_PROMOTION_PLANNED_SALES}
 * {@link TAGS.RETURN_OF_ENTIRE_TRANSACTION_RETURN_OF_ENTIRE_RECEIPT}
 * {@link TAGS.ECO_POINTS}
 * {@link TAGS.CHILDCARE_SUPPORT_POINTS}
 * ### テスト観点
 * * 前提：
 * * テスト観点：
 * * * ・エコポイント・子育て支援ポイントが付与された売上取引が返品できる。
 * * * ・売上時に付与されたポイントが減算される。
 * * * エコポイントと子育て支援ポイントが減算される。
 * 
 * ---
 * ### テスト方法/シナリオ
 * | Step | 手順 | エンドポイント |
 * | :-: | :--- | :--- |
 * | 1 | 取引開始 | `/sales/begin` |
 * | 2 | Aocaカードスキャン | `/sales/cart/barcode` |
 * | 3 | 子育て支援ポイント（タッチパネル）押下 | - |
 * | 4 | ポイント付与専用商品（対象） 1スキャン | `/sales/cart/barcode` |
 * | 5 | ポイント付与専用商品（対象） 2スキャン | `/sales/cart/barcode` |
 * | 6 | ポイント付与専用商品（対象） 3スキャン | `/sales/cart/barcode` |
 * | 7 | エコポイント（タッチパネル）押下 | - |
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
 * * 販売取引はテストの観点に基づき、TC_044で検証済み。 
 * 
 * ---
 * ### テストデータ
 * * 1.クスリのアオキプリペイドカード: 8090227000000006
 * * 2.ポイント付与専用商品（対象） 1: 4520230413021
 * * 3.ポイント付与専用商品（対象） 2: 4520230414001
 * * 4.ポイント付与専用商品（対象） 3: 4911110703001
 * * 5.子育て支援ポイント
 * * \- coupon_amount: 1000
 * * \- bonus_point: 10
 * * 6.エコポイント
 * * \- bonus_point: 1
 * 
 * ---
 * ### 期待結果
 * * #### 8. 小計 `/sales/subtotal`
 * * \- sales.cartinfoデータを取得する（TC_044で実施する）。
 * * #### 9. 支払登録 `/sales/addpayment`
 * * \- sales.total_add_point を記録する。
 * * \- child_point = sales.point_detail[]（子ポイント）を記録する。
 * * \- eco_point = sales.point_detail[]（エコポイント）を記録する。
 * * \- sales.payments[] データを取得する。
 * * #### 12.【返品】小計 `/refund/subtotal`
 * * \- 合計金額が販売取引の金額と一致していることを確認する。
 * * * \+ total_balance_amount = sales.cartinfo.total_balance_amount
 * * #### 13.【返品】支払登録 `/refund/addpayment`
 * * \- 返還される合計ポイントが販売取引と一致していることを確認する。
 * * * \+ planning_add_points.total_add_point = sales.total_add_point
 * * \- 返還される子育て支援ポイントが販売取引と一致していることを確認する。
 * * * \+ planning_add_points.point_detail に以下が含まれる：
 * * * * ・add_point: child_point.add_point  
 * * * * ・promotion_cd: child_point.promotion_cd  
 * * * * ・promotion_name: child_point.promotion_name  
 * * \- 返還されるエコポイントが販売取引と一致していることを確認する。
 * * * \+ planning_add_points.point_detail に以下が含まれる：
 * * * * ・add_point: eco_point.add_point  
 * * * * ・promotion_cd: eco_point.promotion_cd  
 * * * * ・promotion_name: eco_point.promotion_name  
 * * \- 返金金額が販売取引の金額と一致していることを確認する。
 * * * \+ void_payments は sales.payments と一致する：
 * * * * ・void_payments[].paid_cd = sales.payments[].paid_cd  
 * * * * ・void_payments[].paid_name = sales.payments[].paid_name  
 * * * * ・void_payments[].paid_amount = sales.payments[].paid_amount  
 * * \- 返品後の合計金額が0であることを確認する。
 * * * \+ total_balance_amount = 0
 * * #### 14.【返品】取引完了 `/refund/end`
 * * \- 合計ポイント（子ポイント・エコポイントを除く）が差し引かれていることを確認し、レシートに以下を含むこと：
 * * * "- (sales.total_add_point - child_point.add_point - eco_point.add_point)"  
 * * \- 子育て支援ポイントが差し引かれていることを確認し、レシートに以下を含むこと：
 * * * "子育て支援ポイント" および "- child_point.add_point"  
 * * \- エコポイントが差し引かれていることを確認し、レシートに以下を含むこと：
 * * * "エコポイント" および "- eco_point.add_point"  
 * * \- レシートに「ご返金」という情報が含まれ、返金金額が販売取引と一致していることを確認する。
 */
export function TC_021905001_RefundEcoChildcarePointsGrantProcess() {
  group("TC_021905001 エコ・子育てポイント付与の一連操作", () => {
    const step = {
      begin: CommonFunction.getFullDesc(ENDPOINT.SALES_BEGIN),
      barcodeAokiPrepaid: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "Aocaカードスキャン"),
      couponChild: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_COUPON, "子育て支援ポイント（タッチパネル）押下"),
      barcodeDedicatedPointGrantTarget1st: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "ポイント付与専用商品（対象）1スキャン"),
      barcodeDedicatedPointGrantTarget2nd: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "ポイント付与専用商品（対象）2スキャン"),
      barcodeDedicatedPointGrantTarget3rd: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "ポイント付与専用商品（対象）3スキャン"),
      couponEco: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_COUPON, "エコポイント（タッチパネル）押下"),
      subtotal: CommonFunction.getFullDesc(ENDPOINT.SALES_SUBTOTAL),
      payment: CommonFunction.getFullDesc(ENDPOINT.SALES_ADDPAYMENT),
      end: CommonFunction.getFullDesc(ENDPOINT.SALES_END),
      refundBegin: CommonFunction.getFullDesc(ENDPOINT.REFUND_BEGIN),
      refundSubtotal: CommonFunction.getFullDesc(ENDPOINT.REFUND_SUBTOTAL),
      refundPayment: CommonFunction.getFullDesc(ENDPOINT.REFUND_PAYMENT),
      refundEnd: CommonFunction.getFullDesc(ENDPOINT.REFUND_END),
    };

    const barcodeOpTypeMemberReg = 8; // Test data. バーコード業務種別 (8: 会員登録)

    let cartNo = TestHelper.salesBegin(step.begin, {}, [
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
      barcodeOperationType: barcodeOpTypeMemberReg,
    }, [
      CHECK.createStatusCodeCheck(),
    ], ENVIRONMENT.RETRY_TIMES);

    TestHelper.salesCartCoupon(step.couponChild, {
      cartNo,
      couponCode: COUPON.CHILD.CD,
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    TestHelper.salesCartBarcode(step.barcodeDedicatedPointGrantTarget1st, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.DEDICATED_POINT_GRANT_TARGET_1,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    TestHelper.salesCartBarcode(step.barcodeDedicatedPointGrantTarget2nd, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.DEDICATED_POINT_GRANT_TARGET_2,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    TestHelper.salesCartBarcode(step.barcodeDedicatedPointGrantTarget3rd, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.DEDICATED_POINT_GRANT_TARGET_3,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    TestHelper.salesCartCoupon(step.couponEco, {
      cartNo,
      couponCode: COUPON.ECO.CD,
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
    const totalAddPoint = salesCartInfo?.customer?.planning_add_points?.total_add_point;
    const childPointDetail = salesCartInfo?.customer?.planning_add_points?.point_detail?.find(q => q.coupon_cd === COUPON.CHILD.CD);
    const ecoPointDetail = salesCartInfo?.customer?.planning_add_points?.point_detail?.find(q => q.coupon_cd === COUPON.ECO.CD);

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
        name: "Verify the total points returned matches the sales transaction",
        expected: totalAddPoint,
        actual: (res) => res.result?.cartinfo?.customer?.planning_add_points?.total_add_point,
      }),
      CHECK.createEqualsCheck({
        name: "Verify the child promotion points returned matches the sales transaction",
        expected: {
          addPoint: childPointDetail?.add_point,
          promotionCd: childPointDetail?.promotion_cd,
          promotionName: childPointDetail?.promotion_name,
        },
        actual: (res) => {
          const childPointDetailRefund = res.result?.cartinfo?.customer?.planning_add_points?.point_detail?.find(q => q.coupon_cd === COUPON.CHILD.CD);
          return {
            addPoint: childPointDetailRefund?.add_point,
            promotionCd: childPointDetailRefund?.promotion_cd,
            promotionName: childPointDetailRefund?.promotion_name,
          };
        },
      }),
      CHECK.createEqualsCheck({
        name: "Verify the eco promotion points returned matches the sales transaction",
        expected: {
          addPoint: ecoPointDetail?.add_point,
          promotionCd: ecoPointDetail?.promotion_cd,
          promotionName: ecoPointDetail?.promotion_name,
        },
        actual: (res) => {
          const ecoPointDetailRefund = res.result?.cartinfo?.customer?.planning_add_points?.point_detail?.find(q => q.coupon_cd === COUPON.ECO.CD);
          return {
            addPoint: ecoPointDetailRefund?.add_point,
            promotionCd: ecoPointDetailRefund?.promotion_cd,
            promotionName: ecoPointDetailRefund?.promotion_name,
          };
        },
      }),
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
        name: "Verify total point will be deducted (exclude child, eco)",
        expected: true,
        actual: (res) => {
          const excludePromoPoint = `${-(totalAddPoint - childPointDetail?.add_point - ecoPointDetail?.add_point)}p`;
          return CommonFunction.includesItems([
            excludePromoPoint,
          ], res.result?.receipts?.[0]?.receipt_data);
        },
      }),
      CHECK.createEqualsCheck({
        name: "Verify child point will be deducted",
        expected: true,
        actual: (res) => {
          const childPoint = `${-childPointDetail?.add_point}p`;
          return CommonFunction.includesItems([
            childPoint,
          ], res.result?.receipts?.[0]?.receipt_data);
        },
      }),
      CHECK.createEqualsCheck({
        name: "Verify eco point will be deducted",
        expected: true,
        actual: (res) => {
          const ecoPoint = `${-ecoPointDetail?.add_point}p`;
          return CommonFunction.includesItems([
            ecoPoint,
          ], res.result?.receipts?.[0]?.receipt_data);
        },
      }),
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
