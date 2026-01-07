import * as CHECK from "../../../common/common_check.js";
import * as ENDPOINT from "../../../common/endpoint_const.js";
import * as ENVIRONMENT from "../../../common/environment_const.js";
import { group } from "k6";
import * as PROD from "../../../common/constant/product.js";
import { PAID_METHOD } from "../../../common/constant/paid_methods.js";
import { COUPON } from "../../../common/constant/coupon.js";
import { CARD } from "../../../common/constant/card.js";
import { CommonFunction } from "../../../common/common_function.js";
import { TestHelper } from "../../../common/test_helper.js";
import { Formular } from "../../../common/formular.js";
import * as TAGS from "../../../tags/tags_const.js";

/**
 * @function エコ・子育て支援ポイント付与の一連操作
 * @memberof 売上.販売促進（企画販売）
 * @description
 * {@link TAGS.POS}
 * {@link TAGS.SALES}
 * {@link TAGS.SALES_PROMOTION_PLANNED_SALES}
 * {@link TAGS.ECO_POINTS}
 * {@link TAGS.AOCA_POINTS}
 * {@link TAGS.CHILDCARE_SUPPORT_POINTS}
 * ### テスト観点
 * * 前提：
 * * * ・エコポイントと子育て支援ポイントがm_couponに設定されている。
 * * * 付与されるポイント数：m_coupon.bonus_pointに保持。
 * * * ・エコポイントと子育て支援ポイント利用可能店舗がm_coupon_store_detailに設定されている。
 * * * ・エコポイントと子育て支援ポイントがm_coupon_point_card_detailに設定されている。
 * * * ポイント付与対象商品：m_coupon_point_card_detail.point_card_typeの値が
 * * * m_store_item.point_apply_type_1～5の番号と紐づく。
 * * * ・子育て支援ポイントがm_coupon_detail_coupon_amountに設定されている。
 * * * 条件成立合計金額：m_coupon_detail_coupon_amount.coupon_amountに保持。
 * * * エコポイント付与数がm_coupon.bonus_pointに設定されている。
 * * * ・ポイント付与専用商品（対象） 1,2,3：m_store_item.point_apply_type_1～5 = 1（対象）
 * * * ・ポイント付与専用商品（対象） 1,2,3の合計金額 ＞ m_coupon_detail_coupon_amount.coupon_amount（子育て支援P）
 * * テスト観点：
 * * レジ袋が不要と申し出があったお客様に対して従業員がボタンをタッチすると、エコポイント分のポイントを付与する。
 * * 子育て優待パスポートを提示して従業員がボタンをタッチすると、条件成立時に子育て支援ポイント分のポイントを付与する。
 * * * ・エコポイントが付与されること。（m_coupon.bonus_point）
 * * * ・子育て支援ポイントが付与されること。（m_coupon.bonus_point）
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
 * 
 * ---
 * ### 前提条件
 * * 特になし
 * 
 * ---
 * ### テストデータ
 * * 1.クスリのアオキプリペイドカード: 8090227000000006
 * * 2.ポイント付与専用商品（対象） 1: 4520230413021
 * * 3.ポイント付与専用商品（対象） 2: 4520230414001
 * * 4.ポイント付与専用商品（対象） 3: 4911110703001
 * 
 * ---
 * ### 期待結果
 * * #### 2. Aocaカードスキャン `/sales/cart/barcode`
 * * \- total_add_point = 0 であることを確認
 * * #### 3.子育て支援ポイント（タッチパネル）押下
 * * \- 商品が未登録
 * * * \+ cartinfo.items.length = 0
 * * \- 子育て支援ポイントが適用されているが、ポイントが着かないこと
 * * * \+ customer.planning_add_points.point_detail.add_point = 0
 * * * \+ customer.planning_add_points.point_detail.coupon_cd= "Child"
 * * * \+ customer.planning_add_points.point_detail.coupon_name= "子育て支援ポイント"
 * * #### 4.ポイント付与専用商品（対象） 1スキャン
 * * \- total_sales_amount = 378 (< 1000)
 * * \- 子育て支援ポイントが適用されているが、ポイントが着かないこと
 * * * \+ customer.planning_add_points.point_detail.add_point = 0
 * * * \+ customer.planning_add_points.point_detail.coupon_cd= "Child"
 * * * \+ customer.planning_add_points.point_detail.coupon_name= "子育て支援ポイント"
 * * #### 6.ポイント付与専用商品（対象） 3スキャン
 * * \- total_sales_amount = 13334 (> 1000)
 * * \- 子育て支援ポイントが適用されているが、10ポイントが着くこと
 * * * \+ customer.planning_add_points.point_detail.add_point = 10
 * * * \+ customer.planning_add_points.point_detail.coupon_cd= "Child"
 * * * \+ customer.planning_add_points.point_detail.coupon_name= "子育て支援ポイント"
 * * #### 7.エコポイント（タッチパネル）押下
 * * \- エコポイントが着くこと
 * * * \+ customer.planning_add_points.point_detail.add_point = 1
 * * * \+ customer.planning_add_points.point_detail.coupon_cd = 'eco'
 * * * \+ customer.planning_add_points.point_detail.coupon_name = 'エコポイント'
 * * #### 10. 取引完了 `/sales/end`
 * * \- レシートが正しく印刷されている：
 * * * \+ 3つのアイテム「.ポイント付与専用商品（対象） 1、.ポイント付与専用商品（対象）2、.ポイント付与専用商品（対象）3」の情報が含まれている
 * * * \+ ポイントの情報が含まれている
 * * * *         エコポイント: 1p
 * * * *         子育て支援ポイント: 10p
 */
export function TC_011905001_EcoChildcarePointsGrantProcess() {
  group("TC_011905001 エコ・子育て支援ポイント付与の一連操作", () => {
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
    };

    const childCoupon = {
      couponAmount: 1000, //Specified in master m_coupon_detail_coupon_amount
      bonusPoint: 10, //Specified in master m_coupon
    };
    const ecoCouponBonusPoint = 1; //Specified in master m_coupon

    // 1.取引開始 /sales/begin
    const cartNo = TestHelper.salesBegin(step.begin, {}, [
      CHECK.createStatusCodeCheck(),
    ]);

    // 2.Aocaカードスキャン /sales/cart/barcode
    TestHelper.salesCartBarcode(step.barcodeAokiPrepaid, {
      cartNo,
      barcodes: [
        {
          barcode: CARD.AOKI_PREPAID.CODE,
          scan_data_type: "JAN13",
        },
      ],
      barcodeOperationType: 8,
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify total add points of Aoca card",
        expected: 0,
        actual: (res) => res.result?.cartinfo?.customer?.planning_add_points?.total_add_point,
      }),
    ], ENVIRONMENT.RETRY_TIMES);

    // 3.子育て支援ポイント（タッチパネル）押下 /sales/cart/coupon
    TestHelper.salesCartCoupon(step.couponChild, {
      cartNo,
      couponCode: COUPON.CHILD.CD,
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify no items in cart",
        expected: 0,
        actual: (res) => res.result?.cartinfo?.items?.length,
      }),
      CHECK.createEqualsCheck({
        name: "Verify 子育て支援ポイント point have not been added",
        expected: {
          addPoint: 0,
          couponCd: COUPON.CHILD.CD,
          couponName: COUPON.CHILD.NAME,
        },
        actual: (res) => {
          const pointDetail = res.result?.cartinfo?.customer?.planning_add_points?.point_detail?.find(p => p.coupon_cd === COUPON.CHILD.CD);
          return {
            addPoint: pointDetail?.add_point,
            couponCd: pointDetail?.coupon_cd,
            couponName: pointDetail?.coupon_name,
          };
        },
      }),
    ]);

    // 4.ポイント付与専用商品（対象） 1スキャン /sales/cart/barcode
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
      CHECK.createEqualsCheck({
        name: "Verify total sales amount < 1000",
        expected: true,
        actual: (res) =>
          res.result?.cartinfo?.total_sales_amount === Formular.calcTotalSalesAmount(res.result?.cartinfo?.items) &&
          res.result?.cartinfo?.total_sales_amount < childCoupon.couponAmount,
      }),
      CHECK.createEqualsCheck({
        name: "Verify 子育て支援ポイント point have not been added",
        expected: {
          addPoint: 0,
          couponCd: COUPON.CHILD.CD,
          couponName: COUPON.CHILD.NAME,
        },
        actual: (res) => {
          const pointDetail = res.result?.cartinfo?.customer?.planning_add_points?.point_detail?.find(p => p.coupon_cd === COUPON.CHILD.CD);
          return {
            addPoint: pointDetail?.add_point,
            couponCd: pointDetail?.coupon_cd,
            couponName: pointDetail?.coupon_name,
          };
        },
      }),
    ]);

    // 5.ポイント付与専用商品（対象） 2スキャン /sales/cart/barcode
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

    // 6.ポイント付与専用商品（対象） 3スキャン /sales/cart/barcode
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
      CHECK.createEqualsCheck({
        name: "Verify total sales amount > 1000",
        expected: true,
        actual: (res) =>
          res.result?.cartinfo?.total_sales_amount === Formular.calcTotalSalesAmount(res.result?.cartinfo?.items) &&
          res.result?.cartinfo?.total_sales_amount > childCoupon.couponAmount,
      }),
      CHECK.createEqualsCheck({
        name: "Verify 子育て支援ポイント point have been added",
        expected: {
          addPoint: childCoupon.bonusPoint,
          couponCd: COUPON.CHILD.CD,
          couponName: COUPON.CHILD.NAME,
        },
        actual: (res) => {
          const pointDetail = res.result?.cartinfo?.customer?.planning_add_points?.point_detail?.find(p => p.coupon_cd === COUPON.CHILD.CD);
          return {
            addPoint: pointDetail?.add_point,
            couponCd: pointDetail?.coupon_cd,
            couponName: pointDetail?.coupon_name,
          };
        },
      }),
    ]);

    // 7.エコポイント（タッチパネル）押下
    TestHelper.salesCartCoupon(step.couponEco, {
      cartNo,
      couponCode: COUPON.ECO.CD,
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify エコポイント point have been added",
        expected: {
          addPoint: ecoCouponBonusPoint,
          couponCd: COUPON.ECO.CD,
          couponName: COUPON.ECO.NAME,
        },
        actual: (res) => {
          const pointDetail = res.result?.cartinfo?.customer?.planning_add_points?.point_detail?.find(p => p.coupon_cd === COUPON.ECO.CD);
          return {
            addPoint: pointDetail?.add_point,
            couponCd: pointDetail?.coupon_cd,
            couponName: pointDetail?.coupon_name,
          };
        },
      }),
    ]);

    //8.小計 /sales/subtotal
    const totalBalanceAmount = TestHelper.salesSubtotal(step.subtotal, cartNo, [
      CHECK.createStatusCodeCheck(),
    ]).result?.cartinfo?.total_balance_amount;

    // 9.支払登録 /sales/addpayment
    TestHelper.salesAddPayment(step.payment, {
      cartNo,
      paidGroupCode: PAID_METHOD.QRCODE.GROUP_CODE,
      paidCode: PAID_METHOD.QRCODE.PAID_ITEMS.LINE_PAY.PAID_CODE,
      totalBalanceAmount,
      details: ENVIRONMENT.LINEPAY_DETAIL,
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    // 10.取引完了 /sales/end
    TestHelper.salesEnd(step.end, {
      cartNo,
      endDatetime: CommonFunction.getTimeNow(),
      receiptType: 1,
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Receipt data must contain 3 scanned items",
        expected: true,
        actual: (res) => res.result?.receipts?.some(r =>
          r.receipt_data.includes(PROD.DEDICATED_POINT_GRANT_TARGET_1) &&
          r.receipt_data.includes(PROD.DEDICATED_POINT_GRANT_TARGET_2) &&
          r.receipt_data.includes(PROD.DEDICATED_POINT_GRANT_TARGET_3),
        ),
      }),
      CHECK.createEqualsCheck({
        name: "Receipt data include エコポイント",
        expected: true,
        actual: (res) => res.result?.receipts?.some(r =>
          r.receipt_data.includes(ecoCouponBonusPoint + "p"),
        ),
      }),
      CHECK.createEqualsCheck({
        name: "Receipt data include 子育て支援ポイント",
        expected: true,
        actual: (res) => res.result?.receipts?.some(r =>
          r.receipt_data.includes(childCoupon.bonusPoint + "p"),
        ),
      }),
    ]);
  });
}
