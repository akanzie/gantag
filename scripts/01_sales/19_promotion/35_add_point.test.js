import * as CHECK from "../../../common/common_check.js";
import * as ENDPOINT from "../../../common/endpoint_const.js";
import * as ENVIRONMENT from "../../../common/environment_const.js";
import { sleep, group } from "k6";
import * as PROD from "../../../common/constant/product.js";
import { PAID_METHOD } from "../../../common/constant/paid_methods.js";
import { CARD } from "../../../common/constant/card.js";
import { CommonFunction } from "../../../common/common_function.js";
import { TestHelper } from "../../../common/test_helper.js";
import { Formular } from "../../../common/formular.js";
import { PROMOTION } from "../../../common/constant/promotion.js";
import { RECEIPT_TYPE } from "../../../common/constant/receipt_type.js";
import { COUPON } from "../../../common/constant/coupon.js";
import { PROMOTION_POINT } from "../../../common/constant/promotion_point.js";
import * as TAGS from "../../../tags/tags_const.js";

/**
 * @function ポイントプラス
 * @memberof 売上.販売促進（企画販売）
 * @description
 * {@link TAGS.POS}
 * {@link TAGS.SALES}
 * {@link TAGS.SALES_PROMOTION_PLANNED_SALES}
 * {@link TAGS.POINTS_AWARDED}
 * {@link TAGS.AOCA_POINTS}
 * {@link TAGS.GRANT}
 * ### テスト観点
 * * 前提：
 * * * ・m_promotion_detail_itemに設定されている商品→ポイントプラス商品
 * * * ・m_promotion_optional_add_poinに販促のクーポンコードが設定される
 * * * ・m_couponにcoupon_typeが11:AOK_ポイントプラスと設定される
 * * * ・m_couponにbonus_pointが設定される
 * * * ・m_coupon_issueにissue_handling_type が 2と設定される。
 * * テスト観点：
 * * * ・ポイントプラス商品を購入すると、指定ポイント（bonus_point）が付与される
 * 
 * ---
 * ### テスト方法/シナリオ
 * | Step | 手順 | エンドポイント |
 * | :-: | :--- | :--- |
 * | 1 | 取引開始 | `/sales/begin` |
 * | 2 | Aocaカードスキャン | `/sales/cart/barcode` |
 * | 3 | ポイントプラス商品スキャン | `/sales/cart/barcode` |
 * | 4 | 小計 | `/sales/subtotal` |
 * | 5 | 支払登録 | `/sales/addpayment` |
 * | 6 | 取引完了 | `/sales/end` |
 * 
 * ---
 * ### 前提条件
 * * 特になし
 * 
 * ---
 * ### テストデータ
 * * 1.クスリのアオキプリペイドカード: 8090227000000006
 * * 2.ポイントプラス商品: 4520230413010
 * 
 * ---
 * ### 期待結果
 * * #### 3. ポイントプラス商品スキャン `/sales/cart/barcode`
 * * ポイントプラス商品の情報を確認
 * * * \+barcode: 4520230413010
 * * Aocaカードに以下の情報があることを確認
 * * * \+ planning_add_points.point_detail に以下が含まれる
 * * * * \.coupon_cd: "pointplus"
 * * * * \.coupon_name: "特別ポイント"
 * * * * \.coupon_group_cd: "0200"
 * * * * \.bonus_point: 100
 * * #### 4. 小計 `/sales/subtotal`
 * * カートの情報に1つの商品があることを確認
 * * \- ポイントプラス商品
 * * * \+ barcode: 4520230413010
 * * #### 6. 取引完了 `/sales/end`
 * * \- レシートが正しく印刷されている
 * * * \+ 1つのアイテム「ポイントプラス商品」の情報が含まれている
 * * * \+ ボーナスポイントの情報が含まれている：100p
 */
export function TC_011935010_PointPlus() {
  group("TC_011935010 ポイントプラス", () => {
    const step = {
      begin: CommonFunction.getFullDesc(ENDPOINT.SALES_BEGIN),
      barcodeAokiPrepaid: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "Aocaカードスキャン"),
      barcodeCouponPoint: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "ポイントプラス商品スキャン"),
      subtotal: CommonFunction.getFullDesc(ENDPOINT.SALES_SUBTOTAL),
      payment: CommonFunction.getFullDesc(ENDPOINT.SALES_ADDPAYMENT),
      end: CommonFunction.getFullDesc(ENDPOINT.SALES_END),
    };

    // Specified in master m_coupon
    const pointPlusCoupon = {
      couponCd: "pointplus",
      couponName: "特別ポイント",
      couponGroupCd: "0200",
      bonusPoint: 100,
    };

    // 1.取引開始 /sales/begin
    const cartNo = TestHelper.salesBegin(step.begin, {
      operateEmployeeCd: ENVIRONMENT.EMPLOYEE_CD,
      isSelf: false,
      terminalId: ENVIRONMENT.TERMINAL_ID,
    }, [
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
    }, [
      CHECK.createStatusCodeCheck(),
    ], ENVIRONMENT.RETRY_TIMES);

    // 3.ポイントプラス商品スキャン /sales/cart/barcode
    TestHelper.salesCartBarcode(step.barcodeCouponPoint, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.COUPON_POINT,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify ポイントプラス商品: barcode",
        expected: true,
        actual: (res) => CommonFunction.hasItems([
          PROD.COUPON_POINT,
        ], res.result?.cartinfo?.items),
      }),
      CHECK.createEqualsCheck({
        name: "Verify information in customer's Aoca card",
        expected: {
          couponCd: pointPlusCoupon.couponCd,
          couponName: pointPlusCoupon.couponName,
          couponGroupCd: pointPlusCoupon.couponGroupCd,
          bonusPoint: pointPlusCoupon.bonusPoint,
        },
        actual: (res) => {
          const pointDetail = res.result?.cartinfo?.customer?.planning_add_points?.point_detail?.find(p => p.coupon_cd === pointPlusCoupon.couponCd);
          return {
            couponCd: pointDetail?.coupon_cd,
            couponName: pointDetail?.coupon_name,
            couponGroupCd: pointDetail?.coupon_group_cd,
            bonusPoint: pointDetail?.point_detail_point_items?.[0]?.bonus_point,
          };
        },
      }),
    ]);

    // 4.小計 /sales/subtotal
    const totalBalanceAmount = TestHelper.salesSubtotal(step.subtotal, cartNo, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify items length equals 1",
        expected: 1,
        actual: (res) => res.result?.cartinfo?.items?.length,
      }),
      CHECK.createEqualsCheck({
        name: "Verify ポイントプラス商品: barcode",
        expected: true,
        actual: (res) => CommonFunction.hasItems([
          PROD.COUPON_POINT,
        ], res.result?.cartinfo?.items),
      }),
    ]).result?.cartinfo?.total_balance_amount;

    // 5.支払登録 /sales/addpayment
    TestHelper.salesAddPayment(step.payment, {
      cartNo,
      paidGroupCode: PAID_METHOD.QRCODE.GROUP_CODE,
      paidCode: PAID_METHOD.QRCODE.PAID_ITEMS.LINE_PAY.PAID_CODE,
      totalBalanceAmount,
      details: ENVIRONMENT.LINEPAY_DETAIL,
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    // 6.取引完了 /sales/end
    TestHelper.salesEnd(step.end, {
      cartNo,
      endDatetime: CommonFunction.getTimeNow(),
      receiptType: 1,
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Receipt is printed correctly",
        expected: true,
        actual: (res) => res.result?.receipts?.some(r =>
          r.receipt_data.includes(PROD.COUPON_POINT) &&
          r.receipt_data.includes(pointPlusCoupon.bonusPoint + "p")),
      }),
    ]);
  });
}

/**
 * @function ポイント〇倍デー（水/日）
 * @memberof 売上.販売促進（企画販売）
 * @description
 * {@link TAGS.POS}
 * {@link TAGS.SALES}
 * {@link TAGS.SALES_PROMOTION_PLANNED_SALES}
 * {@link TAGS.POINT}
 * {@link TAGS.AOCA_POINTS}
 * {@link TAGS.POINT_MULTIPLIER_UP}
 * ### テスト観点
 * * 前提：
 * * * ・ポイント〇倍デー（水/日）が下記のマスタに設定されている
 * * * * →　m_promotion_all_add_standard_rate_point
 * * * * →　m_promotion_detail_condition
 * * * * →　m_promotion_detail_item
 * * * * →　m_promotion_day_week
 * * * * →　m_promotion_detail_point_card_class
 * * * ・ポイント〇倍デーを判断する情報
 * * * * →　m_promotion_day_week.sunday_promotion_enabled_flg～saturday_promotion_enabled_flgが
 * * * * True：販促が有効
 * * * * False：販促が無効
 * * * ・対象商品の特定
 * * * m_promotion_category_detail.item_upper_category_cd～item_detail_category_cdと同じ分類コード
 * * * を持つ商品
 * * * ・計算式
 * * * ① 基準ポイントの計算式（Aocaの基準ポイント）
 * * *  ポイント対象額÷Aocaのm_promotion_add_standard_point.point_standard_amount
 * * * × Aocaのm_promotion_add_standard_point.point_standard_point
 * * * ② 付与ポイントの計算式
 * * *   基準ポイント（①）
 * * *  × ポイント〇倍デーのm_promotion_all_add_standard_rate_point.point_standard_rate
 * * テスト観点：
 * * 企画に設定された対象の曜日、特定のポイント倍率が適用され、対象外の曜日は適用されない。
 * 
 * ---
 * ### テスト方法/シナリオ
 * | Step | 手順 | エンドポイント |
 * | :-: | :--- | :--- |
 * | 1 | 取引開始 | `/sales/begin` |
 * | 2 | Aocaカードスキャン | `/sales/cart/barcode` |
 * | 3 | ポイント倍対象商品スキャン | `/sales/cart/barcode` |
 * | 4 | ポイント倍対象外商品スキャン | `/sales/cart/barcode` |
 * | 5 | 小計 | `/sales/subtotal` |
 * | 6 | 支払登録 | `/sales/addpayment` |
 * | 7 | 取引完了 | `/sales/end` |
 * 
 * ---
 * ### 前提条件
 * * 特になし
 * 
 * ---
 * ### テストデータ
 * * 1.ポイント倍対象商品:  4520230413100
 * *  かつ 購入日にポイント5倍  5x_point_allday :
 * * * \+  sunday_promotion_enabled_flg-> saturday_promotion_enabled_flg : 1
 * * 2.ポイント倍対象外商品: 4520230413101 for 5x_point_noday
 * * かつ 購入日にポイント0倍 0x_point_allday:
 * *  sunday_promotion_enabled_flg-> saturday_promotion_enabled_flg : 1
 * 
 * ---
 * ### 期待結果
 * * #### "2. Aocaカードスキャン `/sales/cart/barcode`
 * * \- カート情報にAocaカードが含まれていることを確認
 * * * \+ customer_cd: 8090227000000006
 * * * \+ point_card_name: "Aoca"
 * * #### 3. ポイント倍対象商品スキャン `/sales/cart/barcode`
 * * \- total_sales_amount_without_tax equals 200
 * * \- ポイント倍対象商品の情報を確認
 * * * \+ barcode: 4520230413100
 * * * \+ unit_price: 200
 * * * \+ display_unit_price: 200
 * * * \+ quantity: 1
 * * * \+ total_statement_amount: 200
 * * \- ポイント倍対象商品のポイント付与を確認
 * * * \+ planning_add_points.total_add_point: 10 = (200 / 100 * 5)
 * * * \+ planning_add_points.point_detail.add_point: 2 - promotion_cd: "0100" - promotion_name: "基準ポイント_Aoca"
 * * * \+ planning_add_points.point_detail.add_point: 8 - promotion_cd: "5x_point_allday" - promotion_name: "ポイント5倍"
 * * #### 4. ポイント倍対象外商品スキャン `/sales/cart/barcode`
 * * \- ポイント倍対象外商品の情報を確認
 * * * \+ barcode: 4520230413101
 * * * \+ unit_price: 200
 * * * \+ display_unit_price: 200
 * * * \+ quantity: 1
 * * * \+ total_statement_amount: 200
 * * \- ポイント倍対象外商品のポイント付与を確認
 * * * \+ planning_add_points.total_add_point: 10  = (200 / 100 * 5) +  200`/100` * 0
 * * #### 7. 取引完了 `/sales/end`
 * * \- レシートが正しく印刷されていることを確認：
 * * * \+ 2つの商品情報が含まれている：ポイント倍対象商品およびポイント倍対象外商品
 * * * \+ ポイント情報が含まれている：10p"
 */
export function TC_011935003_BonusPointsDay() {
  group("TC_011935003 ポイント〇倍デー（水/日）", () => {
    const step = {
      begin: CommonFunction.getFullDesc(ENDPOINT.SALES_BEGIN),
      barcodeAokiPrepaid: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "Aocaカードスキャン"),
      barcodeMultiplyPoints: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "ポイント倍対象商品スキャン"),
      barcodeUnMultiplyPoints: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "ポイント倍対象外商品スキャン"),
      subtotal: CommonFunction.getFullDesc(ENDPOINT.SALES_SUBTOTAL),
      payment: CommonFunction.getFullDesc(ENDPOINT.SALES_ADDPAYMENT),
      end: CommonFunction.getFullDesc(ENDPOINT.SALES_END),
    };

    const aocaPromotion = {
      pointStandardAmount: 100, //Specified in master m_promotion_add_standard_point 
      addStandardPoint: 1, //Specified in master m_promotion_add_standard_point
    }
    const point5xPromotionStandardRate = 5; //Specified in master m_promotion_all_add_standard_rate_point
    const point0xPromotionStandardRate = 0; //Specified in master m_promotion_all_add_standard_rate_point

    // 1.取引開始 /sales/begin
    const cartNo = TestHelper.salesBegin(step.begin, {
      operateEmployeeCd: ENVIRONMENT.EMPLOYEE_CD,
      isSelf: false,
      terminalId: ENVIRONMENT.TERMINAL_ID,
    }, [
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
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify informations of customer's Aoca card",
        expected: {
          customerCd: CARD.AOKI_PREPAID.CODE,
          pointCardName: CARD.AOKI_PREPAID.NAME,
        },
        actual: (res) => {
          return {
            customerCd: res.result?.cartinfo?.customer?.customer_cd,
            pointCardName: res.result?.cartinfo?.customer?.point_card_name,
          };
        },
      }),
    ], ENVIRONMENT.RETRY_TIMES);

    // 3.ポイント倍対象商品スキャン /sales/cart/barcode
    const totalAddPointBefore = TestHelper.salesCartBarcode(step.barcodeMultiplyPoints, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.MULTIPLY_POINTS,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify information of ポイント倍対象商品",
        expected: (res) => {
          return {
            barcode: PROD.MULTIPLY_POINTS,
            totalStatementAmount: Formular.calcPriceAfterDiscounts(res.result?.cartinfo?.items?.[0]),
            quantity: 1,
          };
        },
        actual: (res) => {
          return {
            barcode: res.result?.cartinfo?.items?.[0]?.barcode,
            totalStatementAmount: res.result?.cartinfo?.items?.[0]?.total_statement_amount,
            quantity: res.result?.cartinfo?.items?.[0]?.quantity,
          };
        },
      }),
      CHECK.createEqualsCheck({
        name: "Verify total sales amount without tax",
        expected: (res) => Formular.calcTotalTaxableAmount(res.result?.cartinfo?.items),
        actual: (res) => res.result?.cartinfo?.total_sales_amount_without_tax,
      }),
      CHECK.createEqualsCheck({
        name: "Verify ポイント倍対象商品 gets points",
        expected: (res) => {
          const standardPointExpected = Formular.calcPointItem({
            cartinfo: res.result?.cartinfo,
            pointStandardAmount: aocaPromotion.pointStandardAmount,
            addStandardPoint: aocaPromotion.addStandardPoint,
          });
          return {
            totalAddPoint: standardPointExpected * point5xPromotionStandardRate,
            aocaAddPoint: standardPointExpected,
            aocaPromotionCd: PROMOTION.AOCA.CD,
            aocaPromotionName: PROMOTION.AOCA.NAME,
            point5xAddPoint: standardPointExpected * point5xPromotionStandardRate - standardPointExpected,
            point5xPromotionCd: PROMOTION.POINT_5X_ALLDAY.CD,
            point5xPromotionName: PROMOTION.POINT_5X_ALLDAY.NAME,
          };
        },
        actual: (res) => {
          const aocaPointDetail = res.result?.cartinfo?.customer?.planning_add_points?.point_detail?.find(p => p.promotion_cd === PROMOTION.AOCA.CD);
          const point5xPointDetail = res.result?.cartinfo?.customer?.planning_add_points?.point_detail?.find(p => p.promotion_cd === PROMOTION.POINT_5X_ALLDAY.CD);
          return {
            totalAddPoint: res.result?.cartinfo?.customer?.planning_add_points?.total_add_point,
            aocaAddPoint: aocaPointDetail?.add_point,
            aocaPromotionCd: aocaPointDetail?.promotion_cd,
            aocaPromotionName: aocaPointDetail?.promotion_name,
            point5xAddPoint: point5xPointDetail?.add_point,
            point5xPromotionCd: point5xPointDetail?.promotion_cd,
            point5xPromotionName: point5xPointDetail?.promotion_name,
          };
        },
      }),
    ]).result?.cartinfo?.customer?.planning_add_points?.total_add_point;

    // 4.ポイント倍対象外商品スキャン /sales/cart/barcode
    TestHelper.salesCartBarcode(step.barcodeUnMultiplyPoints, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.UN_MULTIPLY_POINTS,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify information of ポイント倍対象外商品",
        expected: (res) => {
          return {
            barcode: PROD.UN_MULTIPLY_POINTS,
            totalStatementAmount: Formular.calcPriceAfterDiscounts(res.result?.cartinfo?.items?.[1]),
            quantity: 1,
          };
        },
        actual: (res) => {
          return {
            barcode: res.result?.cartinfo?.items?.[1]?.barcode,
            totalStatementAmount: res.result?.cartinfo?.items?.[1]?.total_statement_amount,
            quantity: res.result?.cartinfo?.items?.[1]?.quantity,
          };
        },
      }),
      CHECK.createEqualsCheck({
        name: "Verify total sales amount without tax",
        expected: (res) => Formular.calcTotalTaxableAmount(res.result?.cartinfo?.items),
        actual: (res) => res.result?.cartinfo?.total_sales_amount_without_tax,
      }),
      CHECK.createEqualsCheck({
        name: "Verify ポイント倍対象商品 no additional points",
        expected: (res) => totalAddPointBefore + Math.trunc(res.result?.cartinfo?.items?.[1].total_statement_amount * res.result?.cartinfo?.items?.[1].quantity / aocaPromotion.pointStandardAmount) * point0xPromotionStandardRate,
        actual: (res) => res.result?.cartinfo?.customer?.planning_add_points?.total_add_point,
      }),
    ]);

    // 5.小計 /sales/subtotal
    const totalBalanceAmount = TestHelper.salesSubtotal(step.subtotal, cartNo, [
      CHECK.createStatusCodeCheck(),
    ]).result?.cartinfo?.total_balance_amount;

    // 6.支払登録 /sales/addpayment
    TestHelper.salesAddPayment(step.payment, {
      cartNo,
      paidGroupCode: PAID_METHOD.QRCODE.GROUP_CODE,
      paidCode: PAID_METHOD.QRCODE.PAID_ITEMS.LINE_PAY.PAID_CODE,
      totalBalanceAmount,
      details: ENVIRONMENT.LINEPAY_DETAIL,
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    // 7.取引完了 /sales/end
    TestHelper.salesEnd(step.end, {
      cartNo,
      endDatetime: CommonFunction.getTimeNow(),
      receiptType: RECEIPT_TYPE.NORMAL.VALUE,
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Receipt data must contain 2 scanned items",
        expected: true,
        actual: (res) => res.result?.receipts.some(r =>
          r.receipt_data.includes(PROD.MULTIPLY_POINTS) &&
          r.receipt_data.includes(PROD.UN_MULTIPLY_POINTS),
        ),
      }),
      CHECK.createEqualsCheck({
        name: "Receipt include information of point",
        expected: true,
        actual: (res) => res.result?.receipts.some(r =>
          r.receipt_data.includes(totalAddPointBefore + "p"),
        ),
      }),
    ]);
  });
}

/**
 * @function Aocaポイントのみ
 * @memberof 売上.販売促進（企画販売）
 * @description
 * {@link TAGS.POS}
 * {@link TAGS.SALES}
 * {@link TAGS.SALES_PROMOTION_PLANNED_SALES}
 * {@link TAGS.POINT}
 * {@link TAGS.AOCA_POINTS}
 * {@link TAGS.GRANT}
 * ### テスト観点
 * * 前提：
 * * * ・Aocaがm_promotion_add_pointに設定されている。
 * * * ポイント付与対象商品：m_promotion_add_point.point_card_typeの値が
 * * * m_store_item.point_apply_type_1～5の番号と紐づく。
 * * * ・Aocaがm_promotion_add_standard_pointに設定されている。
 * * * ポイント基準額：m_promotion_add_standard_point.point_standard_amount
 * * * 付与されるポイント：m_promotion_add_standard_point.add_standard_point
 * * * ・Aocaがm_promotion_detail_point_card_classに設定されている。
 * * * ・ポイント対象商品（上位参照）：m_store_item.point_apply_type_1～5 = 9（対象）
 * * * * かつ、m_item_category.allow_shareholder_benefit_type= 1（対象）
 * * * ・ポイント対象商品（対象）：m_store_item.point_apply_type_1～5 = 1（対象）
 * * * ・ポイント付与専用商品（対象外)：m_store_item.point_apply_type_1～5 = 2（非対象）
 * * * ・支払は現金支払いする。
 * * テスト観点：
 * * Aocaポイント付与の対象商品を購入したものだけAocaポイントが付与される。
 * * * ・ポイント対象商品（上位参照）とポイント対象商品（対象）に付与されるポイント数分が付与される。
 * * * ・ポイント付与専用商品（対象外)はポイントが付与されない。
 * 
 * ---
 * ### テスト方法/シナリオ
 * | Step | 手順 | エンドポイント |
 * | :-: | :--- | :--- |
 * | 1 | 取引開始 | `/sales/begin` |
 * | 2 | Aocaカードスキャン | `/sales/cart/barcode` |
 * | 3 | ポイント対象商品（上位参照）スキャン | `/sales/cart/barcode` |
 * | 4 | ポイント対象商品（対象）スキャン | `/sales/cart/barcode` |
 * | 5 | ポイント付与専用商品（対象外)スキャン | - |
 * | 6 | 小計 | `/sales/subtotal` |
 * | 7 | 支払登録 | `/sales/addpayment` |
 * | 8 | 取引完了 | `/sales/end` |
 * 
 * ---
 * ### 前提条件
 * * 特になし
 * 
 * ---
 * ### テストデータ
 * * 1.クスリのアオキプリペイドカード: 8090227000000006
 * * 2.ポイント対象商品（上位参照）: 4500000000056
 * * 3.ポイント対象商品（対象）: 4520230413001
 * * 4.ポイント付与専用商品（対象外): 4911110703005
 * 
 * ---
 * ### 期待結果
 * * #### 2. Aocaカードスキャン `/sales/cart/barcode`
 * * \- カート情報にAocaカードスキャンが登録されていることを確認する
 * * * \+ customer_cd: 8090227000000006
 * * * \+ point_card_name: "Aoca"
 * * * \+ planning_add_points.total_add_point: 0
 * * #### 3.ポイント対象商品（上位参照）スキャン `/sales/cart/barcode`
 * * \- ポイント対象商品（上位参照）にポイントが付与されることを確認する
 * * * \+ total_sales_amount_without_tax = 400
 * * * \+ customer.planning_add_points.point_detail.add_point: 4
 * * * \+ customer.planning_add_points.point_detail.promotion_cd: 0100
 * * * \+ customer.planning_add_points.point_detail.promotion_name: 基準ポイント_Aoca
 * * #### 4. ポイント対象商品（対象）スキャン `/sales/cart/barcode`
 * * \- ポイント対象商品（対象）にポイントが付与されることを確認する
 * * * \+ total_sales_amount_without_tax = 550
 * * * \+ customer.planning_add_points.point_detail.add_point: 5
 * * * \+ customer.planning_add_points.point_detail.promotion_cd: 0100
 * * * \+ customer.planning_add_points.point_detail.promotion_name: 基準ポイント_Aoca
 * * #### 5. ポイント付与専用商品（対象外)スキャン `/sales/cart/barcode`
 * * \- ポイント付与専用商品（対象外)にポイントが付与されないことを確認する
 * * * \+ total_sales_amount_without_tax = 3619
 * * * \+ customer.planning_add_points.point_detail.add_point: 5
 * * * \+ customer.planning_add_points.point_detail.promotion_cd: 0100
 * * * \+ customer.planning_add_points.point_detail.promotion_name: 基準ポイント_Aoca
 * * #### 6. 小計 `/sales/subtotal`
 * * カート情報に3商品が含まれていることを確認する:
 * * \- ポイント対象商品（上位参照）:
 * * * \+ barcode: 4500000000056
 * * \- ポイント対象商品（対象）:
 * * * \+ barcode: 4520230413001
 * * \- ポイント付与専用商品（対象外):
 * * * \+ barcode: 4911110703005"
 */
export function TC_011935001_OnlyAddPointAoca() {
  group("TC_011935001 Aocaポイントのみ", () => {
    const step = {
      begin: CommonFunction.getFullDesc(ENDPOINT.SALES_BEGIN),
      barcodeAokiPrepaid: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "Aocaカードスキャン"),
      barcodePointTargetReferUpper: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "ポイント対象商品（上位参照）スキャン "),
      barcodePointTarget: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "ポイント対象商品（対象）スキャン "),
      barcodeDedicatedPointGrantExclude: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "ポイント付与専用商品（対象外) スキャン"),
      subtotal: CommonFunction.getFullDesc(ENDPOINT.SALES_SUBTOTAL),
      payment: CommonFunction.getFullDesc(ENDPOINT.SALES_ADDPAYMENT),
      end: CommonFunction.getFullDesc(ENDPOINT.SALES_END),
    };

    const aocaPromotion = {
      pointStandardAmount: 100, //Specified in master m_promotion_add_standard_point 
      addStandardPoint: 1, //Specified in master m_promotion_add_standard_point
    };
    let pointAdded = 0;

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
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify the cart info has Aocaカードスキャン",
        expected: {
          customerCd: CARD.AOKI_PREPAID.CODE,
          pointCardName: CARD.AOKI_PREPAID.NAME,
          totalAddPoint: 0,
        },
        actual: (res) => {
          return {
            customerCd: res.result?.cartinfo?.customer?.customer_cd,
            pointCardName: res.result?.cartinfo?.customer?.point_card_name,
            totalAddPoint: res.result?.cartinfo?.customer?.planning_add_points?.total_add_point,
          };
        },
      }),
    ], ENVIRONMENT.RETRY_TIMES);

    // 3.ポイント対象商品（上位参照）スキャン /sales/cart/barcode
    TestHelper.salesCartBarcode(step.barcodePointTargetReferUpper, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.POINT_TARGET_REFER_UPPER,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify ポイント対象商品（上位参照） gets points",
        expected: (res) => {
          return {
            totalSalesAmountWithoutTax: Formular.calcTotalTaxableAmount(res.result?.cartinfo?.items),
            addPoint: Formular.calcPointItem({
              cartinfo: res.result?.cartinfo,
              pointStandardAmount: aocaPromotion.pointStandardAmount,
              addStandardPoint: aocaPromotion.addStandardPoint,
            }),
            promotionCd: PROMOTION.AOCA.CD,
            promotionName: PROMOTION.AOCA.NAME,
          };
        },
        actual: (res) => {
          const pointDetailAoca = res.result?.cartinfo?.customer?.planning_add_points?.point_detail?.find(pointDetail => pointDetail.promotion_cd === PROMOTION.AOCA.CD);
          return {
            totalSalesAmountWithoutTax: res.result?.cartinfo?.total_sales_amount_without_tax,
            addPoint: pointDetailAoca?.add_point,
            promotionCd: pointDetailAoca?.promotion_cd,
            promotionName: pointDetailAoca?.promotion_name,
          };
        },
      }),
    ]);

    // 4.ポイント対象商品（対象）スキャン /sales/cart/barcode
    const cartInfoBefore = TestHelper.salesCartBarcode(step.barcodePointTarget, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.POINT_TARGET,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify ポイント対象商品（対象）gets points",
        expected: (res) => {
          return {
            totalSalesAmountWithoutTax: Formular.calcTotalTaxableAmount(res.result?.cartinfo?.items),
            addPoint: Formular.calcPointItem({
              cartinfo: res.result?.cartinfo,
              pointStandardAmount: aocaPromotion.pointStandardAmount,
              addStandardPoint: aocaPromotion.addStandardPoint,
            }),
            promotionCd: PROMOTION.AOCA.CD,
            promotionName: PROMOTION.AOCA.NAME,
          };
        },
        actual: (res) => {
          const pointDetailAoca = res.result?.cartinfo?.customer?.planning_add_points?.point_detail?.find(pointDetail => pointDetail.promotion_cd === PROMOTION.AOCA.CD);
          return {
            totalSalesAmountWithoutTax: res.result?.cartinfo?.total_sales_amount_without_tax,
            addPoint: pointDetailAoca?.add_point,
            promotionCd: pointDetailAoca?.promotion_cd,
            promotionName: pointDetailAoca?.promotion_name,
          };
        },
      }),
    ]).result?.cartinfo;

    // 5.ポイント付与専用商品（対象外)スキャン/sales/cart/barcode
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
      CHECK.createEqualsCheck({
        name: "Verify ポイント付与専用商品（対象外) is not gets points",
        expected: (res) => {
          pointAdded = Formular.calcPointItem({
            cartinfo: cartInfoBefore,
            pointStandardAmount: aocaPromotion.pointStandardAmount,
            addStandardPoint: aocaPromotion.addStandardPoint,
          });
          return {
            totalSalesAmountWithoutTax: Formular.calcTotalTaxableAmount(res.result?.cartinfo?.items),
            addPoint: pointAdded,
            promotionCd: PROMOTION.AOCA.CD,
            promotionName: PROMOTION.AOCA.NAME,
          };
        },
        actual: (res) => {
          const pointDetailAoca = res.result?.cartinfo?.customer?.planning_add_points?.point_detail?.find(pointDetail => pointDetail.promotion_cd === PROMOTION.AOCA.CD);
          return {
            totalSalesAmountWithoutTax: res.result?.cartinfo?.total_sales_amount_without_tax,
            addPoint: pointDetailAoca?.add_point,
            promotionCd: pointDetailAoca?.promotion_cd,
            promotionName: pointDetailAoca?.promotion_name,
          };
        },
      }),
    ]);

    // 6.小計 /sales/subtotal
    const totalBalanceAmount = TestHelper.salesSubtotal(step.subtotal, cartNo, [
      CHECK.createStatusCodeCheck(),
    ]).result?.cartinfo?.total_balance_amount;

    // 7.支払登録 /sales/addpayment
    TestHelper.salesAddPayment(step.payment, {
      cartNo,
      paidGroupCode: PAID_METHOD.QRCODE.GROUP_CODE,
      paidCode: PAID_METHOD.QRCODE.PAID_ITEMS.LINE_PAY.PAID_CODE,
      totalBalanceAmount,
      details: ENVIRONMENT.LINEPAY_DETAIL,
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    // 8.取引完了 /sales/end
    TestHelper.salesEnd(step.end, {
      cartNo,
      endDatetime: CommonFunction.getTimeNow(),
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Receipt include information of point",
        expected: true,
        actual: (res) => res.result?.receipts.some(r =>
          r.receipt_data.includes(pointAdded + "p"),
        ),
      }),
    ]);
  });
}

/**
 * @function セット買いポイント（繰返し発生あり）
 * @memberof 売上.レシート印刷
 * @description
 * {@link TAGS.POS}
 * {@link TAGS.SALES}
 * {@link TAGS.RECEIPT_PRINTING}
 * {@link TAGS.SALES_PROMOTION_PLANNED_SALES}
 * {@link TAGS.COUPON_RECEIPT}
 * {@link TAGS.SET}
 * {@link TAGS.POINTS_AWARDED}
 * {@link TAGS.POINT}
 * ### テスト観点
 * * 前提：
 * * * ・セット買いポイントの成立条件
 * * * →　セット買いポイントがm_promotion_set_optional_add_po_pointに設定されている。
 * * * *  セット買い繰返し発生フラグ（成立条件ごとに繰返し）：
 * * * * 　 →　m_promotion_set_optional_add_po_point.buy_set_coupon_multiple_times_flg = True
 * * * * →　セット買いポイントの成立条件がm_promotion_detail_conditionに設定されている。
 * * * * →　対象商品がm_promotion_detail_itemに設定されている。　→　ポイント対象商品（対象）
 * * * * 　　　　　　　　　　　　　　　　　　　　　　　　　　　　  通常商品は設定なし（対象外商品）
 * * * * →　販促が成立する対象商品の合計額が設定されている。
 * * * * m_promotion_detail_promotion_amount.promotion_amount　＜　対象商品の合計額
 * * * →　販促が成立する対象のカードが設定されている。
 * * * * m_promotion_detail_point_card_class.point_card_type = 1：Aocaカード
 * * * ・付与するポイントの情報　　　
 * * * * →　セット買いポイントがm_couponに設定されている。
 * * * * m_coupon.coupon_cd =m_promotion_set_optional_add_po_point.coupon_cd
 * * * * m_coupon.coupon_type = ３：ボーナスポイント付与
 * * * * 付与するポイント：m_coupon.bonus_point　
 * * * ・クーポン発券の情報
 * * * * →　セット買いポイントがm_coupon_issueに設定されている。
 * * *  　m_coupon_issue.coupon_cd = m_promotion_set_optional_add_po_point.coupon_cd
 * *      　　m_coupon.issue_handling_type ＝ ２:クーポン発券時に印字なしで即時利用
 * * "テスト観点：
 * * セット買いポイント設定商品をスキャンした時に、セット買いポイント成立条件を満たした場合、条件成立ごとに繰返しポイント付与のクーポンを発券して即時利用できる。
 * * 例：柿の種とビールを買うとその取引で50Pプレゼント（条件成立ごと）
 * * * ・ポイント対象商品（対象）は２セット分のセット買いポイントが付与される。
 * * * ・ 通常商品はセット買いポイントが付与されない。"
 * 
 * ---
 * ### テスト方法/シナリオ
 * | Step | 手順 | エンドポイント |
 * | :-: | :--- | :--- |
 * | 1 | 取引開始 | `/sales/begin` |
 * | 2 | Aocaカードスキャン | `/sales/cart/barcode` |
 * | 3 | ポイント対象商品（対象）1セット目スキャン | `/sales/cart/barcode` |
 * | - | ※１セット：２個 | - |
 * | 4 | ポイント対象商品（対象）2セット目スキャン | `/sales/cart/barcode` |
 * | - | ※１セット：２個 | - |
 * | 5 | 通常商品スキャン | `/sales/cart/barcode` |
 * | 6 | 小計 | `/sales/subtotal` |
 * | 7 | 支払登録 | `/sales/addpayment` |
 * | 8 | 取引完了 | `/sales/end` |
 * 
 * ---
 * ### 前提条件
 * * 特になし
 * 
 * ---
 * ### テストデータ
 * * 1.クスリのアオキプリペイドカード: 8090227000000006
 * * 2.ポイント対象商品（対象）: 4520230413001
 * * 3.通常商品: 4500000000121
 * * promotion_cd = setoptinonal
 * 
 * ---
 * ### 期待結果
 * * #### 3.ポイント対象商品（対象）1セット目スキャン  `/sales/cart/barcode`
 * * カート情報にボーナスポイント付与が含まれていることを確認
 * * * \+ add_point: 60
 * * * \+ promotion_cd: setoptional
 * * #### 4.ポイント対象商品（対象）2セット目スキャン  `/sales/cart/barcode`
 * * カート情報にボーナスポイント付与が含まれていることを確認
 * * * \+ add_point: 120
 * * * \+ promotion_cd: setoptional
 * * #### 5. 通常商品 `/sales/cart/barcode`
 * * カート情報にボーナスポイント付与が含まれていることを確認
 * * * \+ add_point: 120
 * * * \+ promotion_cd: setoptional
 * * ポイントが変更されていないことを確認：120
 * * #### 6. 小計 `/sales/subtotal`
 * * \- カート情報にAOKカードが含まれていることを確認
 * * * \+ customer_cd: 8090227000000006
 * * * \+ point_card_name: "Aoca"
 * * \- カート情報に5つの商品が含まれていることを確認
 * * ポイント対象商品（対象）が4つ:
 * * * \+ barcode: 4520230413001
 * * 通常商品が1つ:
 * * * \+ barcode: 4500000000121
 * * #### 8. 取引完了 `/sales/end`
 * * \- レシートが正しく印刷されていることを確認
 * * * \+ 5つの商品情報が含まれている
 * * ポイント対象商品（対象）が4つ、通常商品が1つ
 * * * \+ ポイント情報が含まれている：120p
 */
export function TC_011935006_BuyComboRepeat() {
  group("TC_011935006 セット買いポイント（繰返し発生あり）", () => {
    const step = {
      begin: CommonFunction.getFullDesc(ENDPOINT.SALES_BEGIN),
      barcodeAokiPrepaid: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "Aocaカードスキャン"),
      barcodePointTarget1st: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "ポイント対象商品（対象）(1st)スキャン set1"),
      barcodePointTarget2nd: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "ポイント対象商品（対象）(2nd)スキャン set1"),
      barcodePointTarget3rd: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "ポイント対象商品（対象）(1st)スキャン set2"),
      barcodePointTarget4th: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "ポイント対象商品（対象）(2st)スキャン set2"),
      barcodeRegular: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "通常商品スキャン"),
      subtotal: CommonFunction.getFullDesc(ENDPOINT.SALES_SUBTOTAL),
      payment: CommonFunction.getFullDesc(ENDPOINT.SALES_ADDPAYMENT),
      end: CommonFunction.getFullDesc(ENDPOINT.SALES_END),
    };

    const promotion = {
      promotionCd: "setoptional",
      bonusPoint: 60, //Specified in master m_coupon
    }
    let pointDetailAdd1st = null;
    let pointDetailAdd2nd = null;
    let pointDetailAdd3rd = null;

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
    }, [
      CHECK.createStatusCodeCheck(),
    ], ENVIRONMENT.RETRY_TIMES);

    // 3.ポイント対象商品（対象）スキャン set1 /sales/cart/barcode (1st)
    TestHelper.salesCartBarcode(step.barcodePointTarget1st, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.POINT_TARGET,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    // ポイント対象商品（対象）スキャン set1 /sales/cart/barcode (2nd)
    TestHelper.salesCartBarcode(step.barcodePointTarget2nd, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.POINT_TARGET,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify the cart info has ボーナスポイント付与",
        expected: {
          addPoint: promotion.bonusPoint,
          promotionCd: promotion.promotionCd,
        },
        actual: (res) => {
          pointDetailAdd1st = res.result?.cartinfo?.customer.planning_add_points?.point_detail?.find(pointDetail => pointDetail.coupon_cd === promotion.promotionCd);
          return {
            addPoint: pointDetailAdd1st?.add_point,
            promotionCd: pointDetailAdd1st?.promotion_cd,
          };
        },
      }),
    ]);

    // 4.ポイント対象商品（対象）スキャン set2 /sales/cart/barcode (1st)
    TestHelper.salesCartBarcode(step.barcodePointTarget3rd, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.POINT_TARGET,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    // ポイント対象商品（対象）スキャン set2 /sales/cart/barcode (2nd)
    TestHelper.salesCartBarcode(step.barcodePointTarget4th, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.POINT_TARGET,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify the cart info has ボーナスポイント付与",
        expected: {
          addPoint: pointDetailAdd1st.add_point + promotion.bonusPoint,
          promotionCd: promotion.promotionCd,
        },
        actual: (res) => {
          pointDetailAdd2nd = res.result?.cartinfo?.customer.planning_add_points?.point_detail?.find(pointDetail => pointDetail.coupon_cd === promotion.promotionCd);
          return {
            addPoint: pointDetailAdd2nd?.add_point,
            promotionCd: pointDetailAdd2nd?.promotion_cd,
          };
        },
      }),
    ]);

    // 5.通常商品スキャン /sales/cart/barcode
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
      CHECK.createEqualsCheck({
        name: "Verify the cart info has  ボーナスポイント付与 (point not changed)",
        expected: {
          addPoint: pointDetailAdd2nd?.add_point,
          promotionCd: promotion.promotionCd,
        },
        actual: (res) => {
          pointDetailAdd3rd = res.result?.cartinfo?.customer.planning_add_points?.point_detail?.find(pointDetail => pointDetail.coupon_cd === promotion.promotionCd);
          return {
            addPoint: pointDetailAdd3rd?.add_point,
            promotionCd: pointDetailAdd3rd?.promotion_cd,
          };
        },
      }),
    ]);

    // 6.小計 /sales/subtotal
    const totalBalanceAmount = TestHelper.salesSubtotal(step.subtotal, cartNo, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify the cart info has AOK card",
        expected: {
          customerCd: CARD.AOKI_PREPAID.CODE,
          pointCardName: CARD.AOKI_PREPAID.NAME,
        },
        actual: (res) => {
          return {
            customerCd: res.result?.cartinfo?.customer?.customer_cd,
            pointCardName: res.result?.cartinfo?.customer?.point_card_name,
          };
        },
      }),
      CHECK.createEqualsCheck({
        name: "Verify the cart info has 5 products",
        expected: {
          pointTargetLength: 4,
          regularLength: 1,
        },
        actual: (res) => {
          return {
            pointTargetLength: res.result?.cartinfo?.items?.filter(item => item.barcode === PROD.POINT_TARGET)?.length,
            regularLength: res.result?.cartinfo?.items?.filter(item => item.barcode === PROD.REGULAR)?.length,
          };
        },
      }),
    ]).result?.cartinfo?.total_balance_amount;

    // 7.支払登録 /sales/addpayment
    TestHelper.salesAddPayment(step.payment, {
      cartNo,
      paidGroupCode: PAID_METHOD.QRCODE.GROUP_CODE,
      paidCode: PAID_METHOD.QRCODE.PAID_ITEMS.LINE_PAY.PAID_CODE,
      totalBalanceAmount,
      details: ENVIRONMENT.LINEPAY_DETAIL,
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    // 8.取引完了 /sales/end
    TestHelper.salesEnd(step.end, {
      cartNo,
      endDatetime: CommonFunction.getTimeNow(),
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify receipt data must contain scanned items",
        expected: true,
        actual: (res) => CommonFunction.includesItems([
          PROD.POINT_TARGET,
          PROD.REGULAR,
        ], res.result?.receipts?.[res.result?.receipts?.length - 1]?.receipt_data),
      }),
      CHECK.createEqualsCheck({
        name: "Verify receipt data includes information of point",
        expected: true,
        actual: (res) => CommonFunction.includesItems([
          pointDetailAdd2nd?.add_point + "p",
        ], res.result?.receipts?.[res.result?.receipts?.length - 1]?.receipt_data),
      }),
    ]);
  });
}

/**
 * @function ｄポイントのみ
 * @memberof 売上.販売促進（企画販売）
 * @description
 * {@link TAGS.POS}
 * {@link TAGS.SALES}
 * {@link TAGS.SALES_PROMOTION_PLANNED_SALES}
 * {@link TAGS.POINT}
 * {@link TAGS.D_POINT}
 * {@link TAGS.GRANT}
 * ### テスト観点
 * * 前提：
 * * * ・dポイントがm_promotion_add_pointに設定されている。
 * * * ポイント付与対象商品：m_promotion_add_point.point_card_typeの値が
 * * * m_store_item.point_apply_type_1～5の番号と紐づく。
 * * * ・dポイントがm_promotion_add_standard_pointに設定されている。
 * * * ポイント基準額：m_promotion_add_standard_point.point_standard_amount
 * * * 付与されるポイント：m_promotion_add_standard_point.add_standard_point
 * * * ・dポイントがm_promotion_detail_point_card_classに設定されている。
 * * * ・ポイント対象商品（上位参照）：m_store_item.point_apply_type_1～5 = 9（対象）
 * * * * かつ、m_item_category.allow_shareholder_benefit_type= 1（対象）
 * * * ・ポイント付与専用商品（対象）：m_store_item.point_apply_type_1～5 = 1（対象）
 * * * ・ポイント付与専用商品（対象外）：m_store_item.point_apply_type_1～5 = 2（非対象）
 * * テスト観点：
 * * dポイント付与の対象商品を購入したものだけdポイントが付与される。
 * * * ・ポイント対象商品（上位参照）とポイント付与専用商品（対象）に付与されるポイント数分が付与される。
 * * * ・ポイント付与専用商品（対象外）はポイントが付与されない。
 * 
 * ---
 * ### テスト方法/シナリオ
 * | Step | 手順 | エンドポイント |
 * | :-: | :--- | :--- |
 * | 1 | 取引開始 | `/sales/begin` |
 * | 2 | dポイントカードスキャン | `/sales/cart/barcode` |
 * | 3 | ポイント対象商品（上位参照）スキャン | `/sales/cart/barcode` |
 * | 4 | ポイント付与専用商品（対象）スキャン | `/sales/cart/barcode` |
 * | 5 | ポイント付与専用商品（対象外）スキャン | `/sales/cart/barcode` |
 * | 6 | 小計 | `/sales/subtotal` |
 * | 7 | 支払登録 | `/sales/addpayment` |
 * | 8 | 取引完了 | `/sales/end` |
 * 
 * ---
 * ### 前提条件
 * * 特になし
 * 
 * ---
 * ### テストデータ
 * * 1.Dpoint: 100000006699030
 * * 2.ポイント対象商品（上位参照）: 4500000000056
 * * 3.ポイント付与専用商品（対象）1: 4520230413021
 * * 4.ポイント付与専用商品（対象外）: 4911110703005
 * 
 * ---
 * ### 期待結果
 * * #### "2. dポイントカードスキャン `/sales/cart/barcode`
 * * \- カート情報にdポイントカードスキャンが登録されていることを確認する
 * * * \+ customer_cd: 100000006699030
 * * * \+ point_card_name: "dポイントカード"
 * * * \+ planning_add_points.total_add_point: 0
 * * #### 3. ポイント対象商品（上位参照）スキャン `/sales/cart/barcode`
 * * \- ポイント対象商品（上位参照）にポイントが付与されることを確認する
 * * * \+ items.item_cd = 4500000000056
 * * * \+ items.unit_price= 500
 * * * \+ planning_add_points.point_detail.add_point = 2
 * * * \+ planning_add_points.point_detail.promotion_cd= "0200"
 * * * \+ planning_add_points.point_detail.promotion_name= "基準ポイント_dポイント"
 * * #### 4. ポイント付与専用商品（対象）1スキャン `/sales/cart/barcode`
 * * \- ポイント付与専用商品（対象）1にポイントが付与されることを確認する
 * * * \+ items.item_cd = 4520230413021
 * * * \+ items.unit_price= 350
 * * * \+ planning_add_points.point_detail.add_point = 3
 * * * \+ planning_add_points.point_detail.promotion_cd= "0200"
 * * * \+ planning_add_points.point_detail.promotion_name= "基準ポイント_dポイント"
 * * #### 5. ポイント付与専用商品（対象外）スキャン `/sales/cart/barcode`
 * * \- ポイント付与専用商品（対象外） にポイントが付与されないことを確認する
 * * * \+ items.item_cd = 4911110703005
 * * * \+ items.unit_price= 3069
 * * * \+ planning_add_points.point_detail.add_point = 3
 * * * \+ planning_add_points.point_detail.promotion_cd= "0200"
 * * * \+ planning_add_points.point_detail.promotion_name= "基準ポイント_dポイント"
 * * #### 6. 小計 `/sales/subtotal`
 * * \- カート情報に3商品が含まれていることを確認する:
 * * \- ポイント対象商品（上位参照）:
 * * * \+ barcode: 4500000000056
 * * \- ポイント付与専用商品（対象）1:
 * * * \+ barcode: 4520230413021
 * * \- ポイント付与専用商品（対象外）:
 * * * \+ barcode: 4911110703005"
 */
export function TC_011935002_OnlyAddDPoint() {
  group("TC_011935002 ｄポイントのみ", () => {
    const step = {
      begin: CommonFunction.getFullDesc(ENDPOINT.SALES_BEGIN),
      barcodeDPoint: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "dポイントカードスキャン"),
      barcodePointTargetReferUpper: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "ポイント対象商品（上位参照）スキャン "),
      barcodeDedicatedPointGrantTarget1: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "ポイント付与専用商品（対象）スキャン "),
      barcodeDedicatedPointGrantExclude: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "ポイント付与専用商品（対象外）スキャン "),
      subtotal: CommonFunction.getFullDesc(ENDPOINT.SALES_SUBTOTAL),
      payment: CommonFunction.getFullDesc(ENDPOINT.SALES_ADDPAYMENT),
      end: CommonFunction.getFullDesc(ENDPOINT.SALES_END),
    };

    const dPointPromotion = {
      pointStandardAmount: 200, //Specified in master m_promotion_add_standard_point 
      addStandardPoint: 1, //Specified in master m_promotion_add_standard_point
    };
    let pointAdded = 0;

    // 1.取引開始 /sales/begin
    const cartNo = TestHelper.salesBegin(step.begin, {
      operateEmployeeCd: ENVIRONMENT.EMPLOYEE_CD,
      isSelf: false,
      terminalId: ENVIRONMENT.TERMINAL_ID,
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    // 2.dポイントカードスキャン /sales/cart/barcode
    TestHelper.salesCartBarcode(step.barcodeDPoint, {
      cartNo,
      barcodes: [
        {
          barcode: CARD.DPOINT.CODE,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify the cart info has dポイントカード",
        expected: {
          customerCd: CARD.DPOINT.CODE,
          cardName: CARD.DPOINT.NAME,
          totalPoint: 0,
        },
        actual: (res) => {
          const customer = res.result?.cartinfo?.customer;
          return {
            customerCd: customer?.customer_cd,
            cardName: customer?.point_card_name,
            totalPoint: customer?.planning_add_points.total_add_point,
          };
        },
      }),
    ]);

    // 3.ポイント対象商品（上位参照）スキャン /sales/cart/barcode
    TestHelper.salesCartBarcode(step.barcodePointTargetReferUpper, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.POINT_TARGET_REFER_UPPER,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify ポイント対象商品（上位参照） gets points",
        expected: (res) => {
          return {
            itemCd: PROD.POINT_TARGET_REFER_UPPER,
            totalSalesAmountWithoutTax: Formular.calcTotalTaxableAmount(res.result?.cartinfo?.items),
            addPoint: Formular.calcPointItem({
              cartinfo: res.result?.cartinfo,
              pointStandardAmount: dPointPromotion.pointStandardAmount,
              addStandardPoint: dPointPromotion.addStandardPoint,
            }),
            promotionCd: PROMOTION.DPOINT.CD,
            promotionName: PROMOTION.DPOINT.NAME,
          };
        },
        actual: (res) => {
          const cartinfo = res.result?.cartinfo;
          const pointDetailDpoint = res.result?.cartinfo?.customer?.planning_add_points?.point_detail?.find(pointDetail => pointDetail.promotion_cd === PROMOTION.DPOINT.CD);
          return {
            itemCd: cartinfo.items?.[0]?.item_cd,
            totalSalesAmountWithoutTax: cartinfo.total_sales_amount_without_tax,
            addPoint: pointDetailDpoint?.add_point,
            promotionCd: pointDetailDpoint?.promotion_cd,
            promotionName: pointDetailDpoint?.promotion_name,
          };
        },
      }),
    ]);

    // 4.ポイント付与専用商品（対象）スキャン /sales/cart/barcode
    const cartInfoBefore = TestHelper.salesCartBarcode(step.barcodeDedicatedPointGrantTarget1, {
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
        name: "Verify ポイント付与専用商品（対象） gets points",
        expected: (res) => {
          return {
            itemCd: PROD.DEDICATED_POINT_GRANT_TARGET_1,
            totalSalesAmountWithoutTax: Formular.calcTotalTaxableAmount(res.result?.cartinfo?.items),
            addPoint: Formular.calcPointItem({
              cartinfo: res.result?.cartinfo,
              pointStandardAmount: dPointPromotion.pointStandardAmount,
              addStandardPoint: dPointPromotion.addStandardPoint,
            }),
            promotionCd: PROMOTION.DPOINT.CD,
            promotionName: PROMOTION.DPOINT.NAME,
          };
        },
        actual: (res) => {
          const cartinfo = res.result?.cartinfo;
          const pointDetailDpoint = res.result?.cartinfo?.customer?.planning_add_points?.point_detail?.find(pointDetail => pointDetail.promotion_cd === PROMOTION.DPOINT.CD);
          return {
            itemCd: cartinfo.items?.[1]?.item_cd,
            totalSalesAmountWithoutTax: cartinfo.total_sales_amount_without_tax,
            addPoint: pointDetailDpoint?.add_point,
            promotionCd: pointDetailDpoint?.promotion_cd,
            promotionName: pointDetailDpoint?.promotion_name,
          };
        },
      }),
    ]).result?.cartinfo;

    // 5.ポイント付与専用商品（対象外）スキャン /sales/cart/barcode
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
      CHECK.createEqualsCheck({
        name: "Verify ポイント付与専用商品（対象外）is not gets points",
        expected: (res) => {
          pointAdded = Formular.calcPointItem({
            cartinfo: cartInfoBefore,
            pointStandardAmount: dPointPromotion.pointStandardAmount,
            addStandardPoint: dPointPromotion.addStandardPoint,
          });
          return {
            itemCd: PROD.DEDICATED_POINT_GRANT_EXCLUDE,
            totalSalesAmountWithoutTax: Formular.calcTotalTaxableAmount(res.result?.cartinfo?.items),
            addPoint: pointAdded,
            promotionCd: PROMOTION.DPOINT.CD,
            promotionName: PROMOTION.DPOINT.NAME,
          };
        },
        actual: (res) => {
          const cartinfo = res.result?.cartinfo;
          const pointDetailDpoint = res.result?.cartinfo?.customer?.planning_add_points?.point_detail?.find(pointDetail => pointDetail.promotion_cd === PROMOTION.DPOINT.CD);
          pointAdded = pointDetailDpoint?.add_point;
          return {
            itemCd: cartinfo.items?.[2]?.item_cd,
            totalSalesAmountWithoutTax: cartinfo.total_sales_amount_without_tax,
            addPoint: pointDetailDpoint?.add_point,
            promotionCd: pointDetailDpoint?.promotion_cd,
            promotionName: pointDetailDpoint?.promotion_name,
          };
        },
      }),
    ]);

    // 6.小計 /sales/subtotal
    const totalBalanceAmount = TestHelper.salesSubtotal(step.subtotal, cartNo, [
      CHECK.createStatusCodeCheck(),
    ]).result?.cartinfo?.total_balance_amount;

    // 7.支払登録 /sales/addpayment
    TestHelper.salesAddPayment(step.payment, {
      cartNo,
      paidGroupCode: PAID_METHOD.QRCODE.GROUP_CODE,
      paidCode: PAID_METHOD.QRCODE.PAID_ITEMS.LINE_PAY.PAID_CODE,
      totalBalanceAmount,
      details: ENVIRONMENT.LINEPAY_DETAIL,
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    // 8.取引完了 /sales/end
    TestHelper.salesEnd(step.end, {
      cartNo,
      endDatetime: CommonFunction.getTimeNow(),
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Receipt include information of point",
        expected: true,
        actual: (res) => res.result?.receipts.some(r =>
          r.receipt_data.includes(pointAdded + "p"),
        ),
      }),
    ]);
  });
}

/**
 * @function セット買いポイント（繰返し発生なし）
 * @memberof 売上.レシート印刷
 * @description
 * {@link TAGS.POS}
 * {@link TAGS.SALES}
 * {@link TAGS.RECEIPT_PRINTING}
 * {@link TAGS.SALES_PROMOTION_PLANNED_SALES}
 * {@link TAGS.COUPON_RECEIPT}
 * {@link TAGS.SET}
 * {@link TAGS.POINTS_AWARDED}
 * {@link TAGS.POINT}
 * ### テスト観点
 * * 前提：
 * * * ・セット買いポイントの成立条件
 * * * →　セット買いポイントがm_promotion_set_optional_add_po_pointに設定されている。
 * * * *  セット買い繰返し発生フラグ（成立条件で1回のみ）：
 * * * * 　 →　m_promotion_set_optional_add_point.buy_set_coupon_multiple_times_flg = False
 * * * * →　セット買いポイントの成立条件がm_promotion_detail_conditionに設定されている。
 * * * * →　対象商品がm_promotion_detail_itemに設定されている。　→　セット買いポイント商品（繰返しなし）
 * * * * 　　　　　　　　　　　　　　　　　　　　　　　　　　　　  通常商品は設定なし（対象外商品）
 * * * * →　販促が成立する対象商品の合計額が設定されている。
 * * * * m_promotion_detail_promotion_amount.promotion_amount　＜　対象商品の合計額
 * * * →　販促が成立する対象のカードが設定されている。
 * * * * m_promotion_detail_point_card_class.point_card_type = 1：Aocaカード
 * * * ・付与するポイントの情報　　　
 * * * * →　セット買いポイントがm_couponに設定されている。
 * * * * m_coupon.coupon_cd =m_promotion_set_optional_add_po_point.coupon_cd
 * * * * m_coupon.coupon_type = ３：ボーナスポイント付与
 * * * * 付与するポイント：m_coupon.bonus_point　
 * * * ・クーポン発券の情報
 * * * * →　セット買いポイントがm_coupon_issueに設定されている。
 * * *  　m_coupon_issue.coupon_cd = m_promotion_set_optional_add_po_point.coupon_cd
 * *      　　m_coupon.issue_handling_type ＝ ２:クーポン発券時に印字なしで即時利用
 * * テスト観点：
 * * セット買いポイント設定商品をスキャンした時に、セット買いポイント成立条件を満たした場合、一度のみポイント付与のクーポンを発券して即時利用できる。
 * * 例：柿の種とビールを買うとその取引で50Pプレゼント（1セットのみ）
 * * * ・ポイント対象商品（繰返し無し）は１セットのみセット買いポイントが付与される。
 * * * ・通常商品はセット買いポイントが付与されない。
 * 
 * ---
 * ### テスト方法/シナリオ
 * | Step | 手順 | エンドポイント |
 * | :-: | :--- | :--- |
 * | 1 | 取引開始 | `/sales/begin` |
 * | 2 | Aocaカードスキャン | `/sales/cart/barcode` |
 * | 3 | ポイント対象商品（繰返し無し）　1セット目スキャン | `/sales/cart/barcode` |
 * | - | ※１セット：２個 | - |
 * | 4 | ポイント対象商品（繰返し無し）　2セット目スキャン | `/sales/cart/barcode` |
 * | - | ※１セット：２個 | - |
 * | 5 | 通常商品スキャン | `/sales/cart/barcode` |
 * | 6 | 小計 | `/sales/subtotal` |
 * | 7 | 支払登録 | `/sales/addpayment` |
 * | 8 | 取引完了 | `/sales/end` |
 * 
 * ---
 * ### 前提条件
 * * 特になし
 * 
 * ---
 * ### テストデータ
 * * 1.クスリのアオキプリペイドカード: 8090227000000006
 * * 2.ポイント対象商品（繰返し無し）: 4520230413009
 * * 3.通常商品: 4500000000121
 * * promotion_cd = combonorepeat
 * 
 * ---
 * ### 期待結果
 * * #### 3.ポイント対象商品（繰返し無し）1セット目スキャン `/sales/cart/barcode`
 * * Aocaカード情報に以下が含まれていることを確認
 * * * \+ planning_add_points.point_detail に以下が含まれる
 * * * * \.add_point: 60
 * * * * \.bonus_point: 30
 * * #### 6. 小計 `/sales/subtotal`
 * * カート情報に5つの商品が含まれていることを確認
 * * \- ポイント対象商品（繰返し無し）が4つ
 * * * \+ barcode: 4520230413009
 * * \- 通常商品が1つ
 * * * \+ barcode: 4500000000121
 * * ポイントが変更されていないことを確認：60
 * * #### 8. 取引完了 `/sales/end`
 * * \- レシートが正しく印刷されていることを確認：
 * * * \+ 5つの商品情報が含まれている：ポイント対象商品（繰返し無し）が4つ、通常商品が1つ
 * * * \+ ポイント情報が含まれている：60p
 */
export function TC_011935005_BuyComboNoRepeat() {
  group("TC_011935005 セット買いポイント（繰返し発生なし）", () => {
    const step = {
      begin: CommonFunction.getFullDesc(ENDPOINT.SALES_BEGIN),
      barcodeAokiPrepaid: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "Aocaカードスキャン"),
      barcodeProdPointTargetNonRepeat1st: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "ポイント対象商品（繰返し無し）（1セット目の1個目）スキャン"),
      barcodeProdPointTargetNonRepeat2nd: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "ポイント対象商品（繰返し無し）（1セット目の2個目）スキャン"),
      barcodeProdPointTargetNonRepeat3rd: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "ポイント対象商品（繰返し無し）（2セット目の1個目）スキャン"),
      barcodeProdPointTargetNonRepeat4th: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "ポイント対象商品（繰返し無し）（2セット目の2個目）スキャン"),
      barcodeRegular: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "通常商品スキャン"),
      subtotal: CommonFunction.getFullDesc(ENDPOINT.SALES_SUBTOTAL),
      payment: CommonFunction.getFullDesc(ENDPOINT.SALES_ADDPAYMENT),
      end: CommonFunction.getFullDesc(ENDPOINT.SALES_END),
    };

    const promotion = {
      promotionCd: "combonorepeat",
      bonusPoint: 60, //Specified in master m_coupon
    }
    let pointDetailBefore = null;

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
    }, [
      CHECK.createStatusCodeCheck(),
    ], ENVIRONMENT.RETRY_TIMES);

    // 3.ポイント対象商品（繰返し無し）（1セット目の1個目）スキャン /sales/cart/barcode
    TestHelper.salesCartBarcode(step.barcodeProdPointTargetNonRepeat1st, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.POINT_TARGET_NONREPEAT,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    // ポイント対象商品（繰返し無し）（1セット目の2個目）スキャン /sales/cart/barcode
    TestHelper.salesCartBarcode(step.barcodeProdPointTargetNonRepeat2nd, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.POINT_TARGET_NONREPEAT,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify customer's Aoca card has informations add point",
        expected: {
          addPoint: promotion.bonusPoint,
          promotionCd: promotion.promotionCd,
        },
        actual: (res) => {
          pointDetailBefore = res.result?.cartinfo?.customer.planning_add_points?.point_detail.find(pointDetail => pointDetail.coupon_cd === promotion.promotionCd);
          return {
            addPoint: pointDetailBefore?.add_point,
            promotionCd: pointDetailBefore?.promotion_cd,
          };
        },
      }),
    ]);

    // 4.ポイント対象商品（繰返し無し）（2セット目の1個目）スキャン /sales/cart/barcode
    TestHelper.salesCartBarcode(step.barcodeProdPointTargetNonRepeat3rd, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.POINT_TARGET_NONREPEAT,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    // ポイント対象商品（繰返し無し）（2セット目の2個目）スキャン /sales/cart/barcode
    TestHelper.salesCartBarcode(step.barcodeProdPointTargetNonRepeat4th, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.POINT_TARGET_NONREPEAT,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    // 5.通常商品スキャン /sales/cart/barcode
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

    // 6.小計 /sales/subtotal
    const totalBalanceAmount = TestHelper.salesSubtotal(step.subtotal, cartNo, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "The cart info has 5 products",
        expected: 5,
        actual: (res) => res.result?.cartinfo?.items?.length,
      }),
      CHECK.createEqualsCheck({
        name: "Verify the cart info has 4 scanned items: セット買いポイント商品（繰返しなし）を4つ",
        expected: 4,
        actual: (res) => res.result?.cartinfo?.items?.filter(item => item.barcode === PROD.POINT_TARGET_NONREPEAT).length,
      }),
      CHECK.createEqualsCheck({
        name: "Verify the cart info has 1 scanned items: 通常商品を1つ",
        expected: 1,
        actual: (res) => res.result?.cartinfo?.items?.filter(item => item.barcode === PROD.REGULAR).length,
      }),
      CHECK.createEqualsCheck({
        name: "Verify point not changed",
        expected: {
          addPoint: pointDetailBefore?.add_point,
          promotionCd: promotion.promotionCd,
        },
        actual: (res) => {
          const pointDetail = res.result?.cartinfo?.customer.planning_add_points?.point_detail.find(pointDetail => pointDetail.coupon_cd === promotion.promotionCd);
          return {
            addPoint: pointDetail?.add_point,
            promotionCd: pointDetail?.promotion_cd,
          };
        },
      }),
    ]).result?.cartinfo?.total_balance_amount;

    // 7.支払登録 /sales/addpayment
    TestHelper.salesAddPayment(step.payment, {
      cartNo,
      paidGroupCode: PAID_METHOD.QRCODE.GROUP_CODE,
      paidCode: PAID_METHOD.QRCODE.PAID_ITEMS.LINE_PAY.PAID_CODE,
      totalBalanceAmount,
      details: ENVIRONMENT.LINEPAY_DETAIL,
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    // 8.取引完了 /sales/end
    TestHelper.salesEnd(step.end, {
      cartNo,
      endDatetime: CommonFunction.getTimeNow(),
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify receipt data must contain 2 scanned items",
        expected: true,
        actual: (res) => CommonFunction.includesItems([
          PROD.POINT_TARGET_NONREPEAT,
          PROD.REGULAR,
        ], res.result?.receipts?.[res.result?.receipts?.length - 1]?.receipt_data),
      }),
      CHECK.createEqualsCheck({
        name: "Verify receipt data includes information of point",
        expected: true,
        actual: (res) => CommonFunction.includesItems([
          promotion.bonusPoint + "p",
        ], res.result?.receipts?.[res.result?.receipts?.length - 1]?.receipt_data),
      }),
    ]);
  });
}

/**
 * @function ポイントクーポン：販促マスタ企画【発券】
 * @memberof 売上.販売促進（企画販売）
 * @description
 * {@link TAGS.POS}
 * {@link TAGS.SALES}
 * {@link TAGS.SALES_PROMOTION_PLANNED_SALES}
 * {@link TAGS.RECEIPT_PRINTING}
 * {@link TAGS.POINTS_PLUS}
 * {@link TAGS.COUPON_RECEIPT}
 * {@link TAGS.POINTS_AWARDED}
 * ### テスト観点
 * * 前提：
 * * * ・m_promotion_optional_add_pointにcoupon_cd がされる 
 * * * ・m_couponにcoupon_typeが 3 or 10 or 11と設定される
 * * * ・m_couponにbonus_pointが設定される
 * * * ・m_coupon_issueにissue_handling_type が 1と設定される。
 * * * ・m_promotion_detail_itemに設定されている商品→ポイント印刷商品
 * * * ・m_promotion_detail_promotion_amountに対象金額が設定される。
 * * テスト観点：
 * * * ・ポイント印刷商品を購入する。対象金額を超えた時に、
 * * ポイントクーポンが発券される。
 * * ポイントクーポンのポイント数がbonus_pointになっている。
 * 
 * ---
 * ### テスト方法/シナリオ
 * | Step | 手順 | エンドポイント |
 * | :-: | :--- | :--- |
 * | 1 | 取引開始 | `/sales/begin` |
 * | 2 | Aocaカードスキャン | `/sales/cart/barcode` |
 * | 3 | ポイント印刷商品スキャン | `/sales/cart/barcode` |
 * | 4 | 売価変更 | `/sales/cart/changeitemprice` |
 * | 5 | 小計 | `/sales/subtotal` |
 * | 6 | 支払登録 | `/sales/addpayment` |
 * | 7 | 取引完了 | `/sales/end` |
 * 
 * ---
 * ### 前提条件
 * * 特になし
 * 
 * ---
 * ### テストデータ
 * * 1.クスリのアオキプリペイドカード: 8090227000000006
 * * 2.ポイント印刷商品: 4520230413019
 * * \-> 価格変更 = 1000
 * * 3.promotion_cd = 10000020300
 * 
 * ---
 * ### 期待結果
 * * #### 3. ポイント印刷商品  `/sales/cart/barcode`
 * * \- 元の売価でポイント印刷商品が登録されていることを確認
 * * * \+ barcode: 4520230413019
 * * * \+ unit_price: 150
 * * #### 4. 売価変更 `/sales/cart/changeitemprice`
 * * \- 売価変更後のポイント印刷商品が表示価格で登録されていることを確認
 * * * \+ barcode: 4520230413019
 * * * \+ display_unit_price: 1000
 * * #### 5. 小計 `/sales/subtotal`
 * * \- カート情報に 1 商品（ポイント印刷商品）が含まれていることを確認
 * * * \+ barcode: 4520230413019
 * * #### 7. 取引完了 `/sales/end`
 * * \- レシートが正しく印字されることを確認
 * * * \+ receipt_type: 3（お買物券、キャンペーン券）の情報が含まれる
 * * * \+ 1 商品（ポイント印刷商品）の情報が含まれる
 * * * \+ クーポン情報に画像ファイル: 10000020300.bmp が含まれる
 * * * \+ クーポンバーコードが 2 つ含まれること（フォーマット確認）
 * * * * \. バーコード1: 501xxxxxxxxxxxxxxxxx（20桁）
 * * * *           （"501" + promotion_cd（11桁）+ store_cd（4桁）+ チェックディジット1（1桁）+ チェックディジット2（1桁））
 * * * * \. バーコード2: 502xxxxxxxxxxxxxxxxx（20桁）
 * * * *           （"502" + issuse_no（2桁）+ pos_cd（2桁）+ date（YYMMDD）（8桁）+ receipt_no（6桁）+ チェックディジット（1桁））
 */
export function TC_011935011_PointTicketing() {
  group("TC_011935011 ポイントクーポン：販促マスタ企画【発券】", () => {
    const step = {
      begin: CommonFunction.getFullDesc(ENDPOINT.SALES_BEGIN),
      barcode1: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "Aocaカード"),
      barcode2: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "ポイント対象商品"),
      changeItemPrice: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_CHANGE_ITEM_PRICE, "ポイント対象商品"),
      subtotal: CommonFunction.getFullDesc(ENDPOINT.SALES_SUBTOTAL),
      payment: CommonFunction.getFullDesc(ENDPOINT.SALES_ADDPAYMENT),
      end: CommonFunction.getFullDesc(ENDPOINT.SALES_END),
    };

    const couponCd = "10000020300"; // Specified in master m_coupon_issue

    // 1.取引開始 /sales/begin
    const cartNo = TestHelper.salesBegin(step.begin, {}, [
      CHECK.createStatusCodeCheck(),
    ]);

    // 2.Aocaカードスキャン /sales/cart/barcode
    TestHelper.salesCartBarcode(step.barcode1, {
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

    // 3.ポイント対象商品スキャン /sales/cart/barcode
    TestHelper.salesCartBarcode(step.barcode2, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.POINT_PROMO,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify ポイント印刷商品 with original price",
        expected: {
          barcode: PROD.POINT_PROMO,
          unitPrice: 150,
        },
        actual: (res) => ({
          barcode: res.result?.cartinfo?.items?.[0].barcode,
          unitPrice: res.result?.cartinfo?.items?.[0].unit_price,
        }),
      }),
    ]);

    // 4.ポイント対象商品 (対象)売価変更 /sales/cart/changeitemprice
    TestHelper.salesCartChangeItemPrice(step.changeItemPrice, {
      cartNo,
      statementNo: 0,
      updatedPrice: 1000,
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify ポイント印刷商品 with changed price",
        expected: {
          barcode: PROD.POINT_PROMO,
          displayUnitPrice: 1000,
        },
        actual: (res) => ({
          barcode: res.result?.cartinfo?.items?.[0].barcode,
          displayUnitPrice: res.result?.cartinfo?.items?.[0].display_unit_price,
        }),
      }),
    ]);

    // 5.小計 /sales/subtotal
    const totalBalanceAmount = TestHelper.salesSubtotal(step.subtotal, cartNo, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify items length equals 1",
        expected: 1,
        actual: (res) => res.result?.cartinfo?.items?.length,
      }),
      CHECK.createEqualsCheck({
        name: "Verify ポイント印刷商品: barcode",
        expected: true,
        actual: (res) => CommonFunction.hasItems([
          PROD.POINT_PROMO,
        ], res.result?.cartinfo?.items),
      }),
    ]).result?.cartinfo?.total_balance_amount;

    // 6.支払登録 /sales/addpayment
    TestHelper.salesAddPayment(step.payment, {
      cartNo,
      paidGroupCode: PAID_METHOD.QRCODE.GROUP_CODE,
      paidCode: PAID_METHOD.QRCODE.PAID_ITEMS.LINE_PAY.PAID_CODE,
      totalBalanceAmount,
      details: ENVIRONMENT.LINEPAY_DETAIL,
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    // 7.取引完了 /sales/end
    TestHelper.salesEnd(step.end, {
      cartNo,
      endDatetime: CommonFunction.getTimeNow(),
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify receipt type equals 3 (お買物券、キャンペーン券)",
        expected: 3,
        actual: (res) => res.result?.receipts?.[0]?.receipt_type,
      }),
      CHECK.createEqualsCheck({
        name: "Verify receipt data must contain scanned items",
        expected: true,
        actual: (res) => CommonFunction.includesItems([
          PROD.POINT_PROMO,
        ], res.result?.receipts?.[res.result?.receipts?.length - 1].receipt_data),
      }),
      CHECK.createEqualsCheck({
        name: "Verify receipt data must contain coupon image",
        expected: true,
        actual: (res) => res.result?.receipts?.some(r =>
          r.receipt_data?.includes(`${couponCd}.bmp`)),
      }),
      CHECK.createEqualsCheck({
        name: "Verify receipt data includes 2 barcode of add point coupon",
        expected: true,
        actual: (res) => {
          const couponReceipt = res.result?.receipts?.find(r => r.receipt_data.includes(`${couponCd}.bmp`));
          const pattern = /(501|502)\d{17}/g;
          const data = CommonFunction.getBarcodeData(res, pattern, couponReceipt?.receipt_data);
          return data?.barcodePart1 != null && data?.barcodePart2 != null;
        },
      }),
    ]);
  });
}

/**
 * @function ポイントクーポン【使用】
 * @memberof 売上.販売促進（企画販売）
 * @description
 * {@link TAGS.POS}
 * {@link TAGS.SALES}
 * {@link TAGS.POINT}
 * {@link TAGS.SALES_PROMOTION_PLANNED_SALES}
 * {@link TAGS.AOCA_POINTS}
 * {@link TAGS.POINTS_PLUS}
 * {@link TAGS.GRANT}
 * ### テスト観点
 * * 前提：
 * * * ・m_coupon_item_category_detailに設定されている商品 →販促商品
 * * * ・m_coupon_store_detailに設定されている店舗→店舗01
 * * * ・m_coupon_detail_posに設定されているPOSタイプ
 * * テスト観点：
 * * * ・対象店舗・POSで対象商品を購入し、ポイントクーポンを登録すると、クーポン提示でポイントが付与される。
 * 
 * ---
 * ### テスト方法/シナリオ
 * | Step | 手順 | エンドポイント |
 * | :-: | :--- | :--- |
 * | 1 | 取引開始 | `/sales/begin` |
 * | 2 | Aocaカードスキャン | `/sales/cart/barcode` |
 * | 3 | 販促商品スキャン | `/sales/cart/barcode` |
 * | 4 | ポイントクーポン登録 | `/sales/cart/barcode` |
 * | 5 | 小計 | `/sales/subtotal` |
 * | 6 | 支払登録 | `/sales/addpayment` |
 * | 7 | 取引完了 | `/sales/end` |
 * 
 * ---
 * ### 前提条件
 * * 「ポイントクーポン：販促マスタ企画【発券】」シナリオで発券したクーポンを利用
 * 
 * ---
 * ### テストデータ
 * * 1.クスリのアオキプリペイドカード: 8090227000000006
 * * 2.販促商品 : 4500000000032
 * * 3.ポイントクーポン:
 * * * \+ barcode 1: 501xxxxxxxxxxxxxxxxx
 * * * \+ barcode 2: 502xxxxxxxxxxxxxxxxx
 * 
 * ---
 * ### 期待結果
 * * #### 4. ポイントクーポン登録 `/sales/cart/barcode`
 * * カートの情報にポイントクーポン登録があることを確認
 * * * \+ add_point: 50
 * * * \+ coupon_cd: "10000020300"
 * * #### 5. 小計 `/sales/subtotal`
 * * \- カートの情報にAOKカードがあることを確認
 * * * \+ customer_cd: 8090227000000006
 * * * \+ point_card_name: "Aoca"
 * * \- カートの情報に販促商品があることを確認
 * * * \+ barcode: 4500000000032
 * * #### 7. 取引完了 `/sales/end`
 * * \- レシートが正しく印刷されている、1つのアイテム「販促商品」の情報が含まれている
 */
export function TC_011935012_UsePointCoupon() {
  group("TC_011935012 ポイントクーポン【使用】", () => {
    // Precondition steps TC_011935011
    const preStep = {
      begin: CommonFunction.getFullDesc(ENDPOINT.SALES_BEGIN, "Precondition"),
      barcodeAokiPrepaid: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "Aocaカード Precondition"),
      barcodePointPromo: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "ポイント対象商品 Precondition"),
      changeItemPrice: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_CHANGE_ITEM_PRICE, "ポイント対象商品 Precondition"),
      subtotal: CommonFunction.getFullDesc(ENDPOINT.SALES_SUBTOTAL, "Precondition"),
      payment: CommonFunction.getFullDesc(ENDPOINT.SALES_ADDPAYMENT, "Precondition"),
      end: CommonFunction.getFullDesc(ENDPOINT.SALES_END, "Precondition"),
    };

    // Main steps TC_011935012
    const step = {
      certification: CommonFunction.getFullDesc(ENDPOINT.TMN_PREPAID_CERTIFICATION),
      getBalanceBefore: CommonFunction.getFullDesc(ENDPOINT.TMN_PREPAID_GET_BALANCE, "残高照会 check point before scan voucher barcode"),
      begin: CommonFunction.getFullDesc(ENDPOINT.SALES_BEGIN),
      barcodeAokiPrepaid: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "Aocaカード"),
      barcodeRegularPromotion: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "販促商品"),
      barcodeVoucher: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "ポイントクーポン登録"),
      subtotal: CommonFunction.getFullDesc(ENDPOINT.SALES_SUBTOTAL),
      payment: CommonFunction.getFullDesc(ENDPOINT.SALES_ADDPAYMENT),
      end: CommonFunction.getFullDesc(ENDPOINT.SALES_END),
      getBalanceAfter: CommonFunction.getFullDesc(ENDPOINT.TMN_PREPAID_CHARGE_BEGIN, "残高照会 check point after scan voucher barcode"),
    };

    const pointsRequiredFor500Yen = 500; // For every 500 points, a 500円 voucher will be issued.
    const aocaPromotion = {
      pointStandardAmount: 100, //Specified in master m_promotion_add_standard_point 
      addStandardPoint: 1, //Specified in master m_promotion_add_standard_point
    };
    const coupon = {
      couponCd: "10000020300", // Specified in master m_coupon
      bonusPoint: 50, // Specified in master m_coupon
    };

    // Precondition. The verify has been tested at TC_011935011
    // 1.取引開始 /sales/begin
    const cartNoPreStep = TestHelper.salesBegin(preStep.begin, {}, [
      CHECK.createStatusCodeCheck(),
    ]);

    // 2.Aocaカードスキャン /sales/cart/barcode
    TestHelper.salesCartBarcode(preStep.barcodeAokiPrepaid, {
      cartNo: cartNoPreStep,
      barcodes: [
        {
          barcode: CARD.AOKI_PREPAID.CODE,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
    ], ENVIRONMENT.RETRY_TIMES);

    // 3.ポイント対象商品スキャン /sales/cart/barcode
    TestHelper.salesCartBarcode(preStep.barcodePointPromo, {
      cartNo: cartNoPreStep,
      barcodes: [
        {
          barcode: PROD.POINT_PROMO,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    // 4.ポイント対象商品売価変更 /sales/cart/changeitemprice
    TestHelper.salesCartChangeItemPrice(preStep.changeItemPrice, {
      cartNo: cartNoPreStep,
      statementNo: 0,
      updatedPrice: 1000,
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    // 5.小計 /sales/subtotal
    const totalBalanceAmountPreStep = TestHelper.salesSubtotal(preStep.subtotal, cartNoPreStep, [
      CHECK.createStatusCodeCheck(),
    ]).result?.cartinfo?.total_balance_amount;

    // 6.支払登録 /sales/addpayment
    TestHelper.salesAddPayment(preStep.payment, {
      cartNo: cartNoPreStep,
      paidGroupCode: PAID_METHOD.QRCODE.GROUP_CODE,
      paidCode: PAID_METHOD.QRCODE.PAID_ITEMS.LINE_PAY.PAID_CODE,
      totalBalanceAmount: totalBalanceAmountPreStep,
      details: ENVIRONMENT.LINEPAY_DETAIL,
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    // 7.取引完了 /sales/end
    const resultEnd = TestHelper.salesEnd(preStep.end, {
      cartNo: cartNoPreStep,
      endDatetime: CommonFunction.getTimeNow(),
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    sleep(3);

    const couponReceipt = resultEnd.result?.receipts?.find(r => r.receipt_data.includes(coupon.couponCd));

    const pattern = /(501|502)\d{17}/g;
    const preData = CommonFunction.getBarcodeData(resultEnd, pattern, couponReceipt.receipt_data);

    // Main test case
    // 認証 /tpi_v1/terminal/generatekey
    TestHelper.tmnPrepaidCertification(step.certification, [
      CHECK.createStatusCodeCheck(),
    ]);

    // 0.残高照会 /tpi_v1/holder/getbalance
    const pointBefore = TestHelper.tmnPrepaidGetBalance(step.getBalanceBefore, {
      cardNo: CARD.AOKI_PREPAID.CODE,
    }, [
      CHECK.createStatusCodeCheck(),
    ]).result?.card_info?.point_count_sum;

    // 1.取引開始 /sales/begin
    const cartNo = TestHelper.salesBegin(step.begin, {
      signnedEmployeeCd: "",
      operateEmployeeCd: ENVIRONMENT.EMPLOYEE_CD,
      isSelf: false,
      terminalId: ENVIRONMENT.TERMINAL_ID,
    }, [
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
    }, [
      CHECK.createStatusCodeCheck(),
    ], ENVIRONMENT.RETRY_TIMES);

    // 3.販促商品スキャン /sales/cart/barcode
    const aocaAddPoint = TestHelper.salesCartBarcode(step.barcodeRegularPromotion, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.REGULAR_PROMOTION,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify 販促商品 gets points",
        expected: (res) => {
          return {
            totalSalesAmountWithoutTax: Formular.calcTotalTaxableAmount(res.result?.cartinfo?.items),
            addPoint: Formular.calcPointItem({
              cartinfo: res.result?.cartinfo,
              pointStandardAmount: aocaPromotion.pointStandardAmount,
              addStandardPoint: aocaPromotion.addStandardPoint,
            }),
            promotionCd: PROMOTION.AOCA.CD,
            promotionName: PROMOTION.AOCA.NAME,
          };
        },
        actual: (res) => {
          const pointDetailAoca = res.result?.cartinfo?.customer?.planning_add_points?.point_detail?.find(pointDetail => pointDetail.promotion_cd === PROMOTION.AOCA.CD);
          return {
            totalSalesAmountWithoutTax: res.result?.cartinfo?.total_sales_amount_without_tax,
            addPoint: pointDetailAoca?.add_point,
            promotionCd: pointDetailAoca?.promotion_cd,
            promotionName: pointDetailAoca?.promotion_name,
          };
        },
      }),
    ]).result?.cartinfo?.customer?.planning_add_points?.point_detail?.find(pointDetail => pointDetail.promotion_cd === PROMOTION.AOCA.CD).add_point;

    // 4.ポイントクーポン登録スキャン /sales/cart/barcode
    TestHelper.salesCartBarcode(step.barcodeVoucher, {
      cartNo,
      barcodes: [
        {
          barcode: preData?.barcodePart1,
          scan_data_type: "JAN13",
        },
        {
          barcode: preData?.barcodePart2,
          scan_data_type: "JAN13",
        },
      ],
      barcodeOperationType: 3,
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify cart info has ポイントクーポン登録",
        expected: {
          addPoint: coupon.bonusPoint,
          couponCd: coupon.couponCd,
        },
        actual: (res) => {
          const pointDetail = res.result?.cartinfo?.customer.planning_add_points?.point_detail.find(pointDetail => pointDetail.coupon_cd === coupon.couponCd);
          return {
            addPoint: pointDetail?.add_point,
            couponCd: pointDetail?.coupon_cd,
          };
        },
      }),
    ]);

    // 5.小計 /sales/subtotal
    const totalBalanceAmount = TestHelper.salesSubtotal(step.subtotal, cartNo, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify cart info has AOK card",
        expected: {
          customerCd: CARD.AOKI_PREPAID.CODE,
          pointCardName: CARD.AOKI_PREPAID.NAME,
        },
        actual: (res) => {
          return {
            customerCd: res.result?.cartinfo?.customer?.customer_cd,
            pointCardName: res.result?.cartinfo?.customer?.point_card_name,
          };
        },
      }),
      CHECK.createEqualsCheck({
        name: "Verify items length equals 1",
        expected: 1,
        actual: (res) => res.result?.cartinfo?.items?.length,
      }),
      CHECK.createEqualsCheck({
        name: "Verify 販促商品: barcode",
        expected: true,
        actual: (res) => CommonFunction.hasItems([
          PROD.REGULAR_PROMOTION,
        ], res.result?.cartinfo?.items),
      }),
    ]).result?.cartinfo?.total_balance_amount;

    // 6.支払登録 /sales/addpayment
    TestHelper.salesAddPayment(step.payment, {
      cartNo,
      paidGroupCode: PAID_METHOD.QRCODE.GROUP_CODE,
      paidCode: PAID_METHOD.QRCODE.PAID_ITEMS.LINE_PAY.PAID_CODE,
      totalBalanceAmount,
      details: ENVIRONMENT.LINEPAY_DETAIL,
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    // 7.取引完了 /sales/end
    TestHelper.salesEnd(step.end, {
      cartNo,
      endDatetime: CommonFunction.getTimeNow(),
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify receipt data must contain scanned items",
        expected: true,
        actual: (res) => CommonFunction.includesItems([
          PROD.REGULAR_PROMOTION,
        ], res.result?.receipts?.[res.result?.receipts?.length - 1]?.receipt_data),
      }),
      CHECK.createEqualsCheck({
        name: "Verify receipt data must contain information of bonus point",
        expected: true,
        actual: (res) => CommonFunction.includesItems([
          coupon.bonusPoint + "p",
        ], res.result?.receipts?.[res.result?.receipts?.length - 1]?.receipt_data),
      }),
    ]);

    sleep(3);

    // 認証 /tpi_v1/terminal/generatekey
    TestHelper.tmnPrepaidCertification(step.certification, [
      CHECK.createStatusCodeCheck(),
    ]);

    // 8.残高照会 /tpi_v1/holder/getbalance
    TestHelper.tmnPrepaidGetBalance(step.getBalanceAfter, {
      cardNo: CARD.AOKI_PREPAID.CODE,
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify points have been added to card",
        expected: (pointBefore + coupon.bonusPoint + aocaAddPoint) % pointsRequiredFor500Yen,
        actual: (res) => res.result?.card_info?.point_count_sum,
      }),
    ]);
  });
}

/**
 * @function ブランド属性商品（ボーナスポイントも同様の動き）
 * @memberof 売上.販売促進（企画販売）
 * @description
 * {@link TAGS.POS}
 * {@link TAGS.SALES}
 * {@link TAGS.POINT}
 * {@link TAGS.SALES_PROMOTION_PLANNED_SALES}
 * {@link TAGS.AOCA_POINTS}
 * {@link TAGS.POINT_MULTIPLIER_UP}
 * {@link TAGS.GRANT}
 * {@link TAGS.PRODUCT_UNIT}
 * ### テスト観点
 * * 前提：
 * * * ・ブランド属性商品が下記のマスタに設定されている
 * * * * →　m_promotion_prt_add_standard_rate_point
 * * * * →　m_promotion_detail_condition
 * * * * →　m_promotion_detail_item_attribute
 * * * * →　m_promotion_day_week
 * * * * →　m_promotion_detail_point_card_class
 * * * ・ブランド属性商品デーを判断する情報
 * * * * →　m_promotion_day_week.sunday_promotion_enabled_flg～saturday_promotion_enabled_flgが
 * * * * True：販促が有効
 * * * * False：販促が無効
 * * * ・対象商品の特定
 * * * m_promotion_detail_item_attribu.item_attribute_cdと同じ属性の値が、
 * * * m_store_item.item_attribute_cd_1～5のいずれかに設定されている商品が対象となる。
 * * * ・ブランド属性商品がm_couponに設定されている。
 * * * m_coupon.coupon_cd = m_promotion_prt_add_standard_rate_point.coupon_cd
 * * * ・ブランド属性商品がm_coupon_issueに設定されている。
 * * * m_coupon.coupon_cd_issue = m_promotion_prt_add_standard_rate_point.coupon_cd
 * * * →　クーポンの発券（印字の有無）を判断
 * * * * m_coupon.issue_handling_type ＝ ２:クーポン発券時に印字なしで即時利用
 * * * ・計算式
 * * * ① 基準ポイントの計算式（Aocaの基準ポイント）
 * * *  ポイント対象額÷Aocaのm_promotion_add_standard_point.point_standard_amount
 * * * × Aocaのm_promotion_add_standard_point.point_standard_point
 * * * ② 付与ポイントの計算式
 * * *   基準ポイント（①）
 * * *  × ブランド属性商品のm_coupon.point_standard_rate
 * * テスト観点：
 * * 特定のブランドの商品を登録した場合、異なるポイント倍率を自動的に適用する基準ポイントに対して、指定した倍率をかけてクーポンを発券して即時利用できる。
 * * * ・ブランド属性商品にブランド属性商品のポイントが付与される。
 * 
 * ---
 * ### テスト方法/シナリオ
 * | Step | 手順 | エンドポイント |
 * | :-: | :--- | :--- |
 * | 1 | 取引開始 | `/sales/begin` |
 * | 2 | Aocaカードスキャン | `/sales/cart/barcode` |
 * | 3 | ブランド属性商品スキャン | `/sales/cart/barcode` |
 * | 4 | 小計 | `/sales/subtotal` |
 * | 5 | 支払登録 | `/sales/addpayment` |
 * | 6 | 取引完了 | `/sales/end` |
 * 
 * ---
 * ### 前提条件
 * * 特になし
 * 
 * ---
 * ### テストデータ
 * * 1.ブランド属性商品: 4520230413112
 * * 2.promotion ブランド属性プロモーション :
 * * \- promotion_cd: brand_attribute
 * * \- coupon setting:
 * * * \+ coupon_cd: brand_attribute
 * * * \+ point_standard_rate : 5
 * * 3.promotion: 基準ポイント_Aoca: 
 * * * * \+ point_standard_amount: 100
 * * * * \+ add_standard_point: 1
 * * (settting:  mua 100 Yên được +1 điểm )
 * 
 * ---
 * ### 期待結果
 * * #### 2.Aocaカードスキャン `/sales/cart/barcode`
 * * \- 顧客のAocaカードに以下の情報が含まれていることを確認する：
 * * * \+ customer_cd: 8090227000000006
 * * * \+ point_card_name: "Aoca"
 * * #### 3.ブランド属性商品スキャン `/sales/cart/barcode`
 * * \- カート情報にブランド属性商品が含まれていることを確認する：
 * * * \+ barcode: 4520230413112
 * * \- Aoca基準ポイントを確認する：
 * * * \+ total_sales_amount_without_tax = display_unit_price × quantity = 500 × 1 = 500
 * * * \+ プロモーション「基準ポイント_Aoca」：
 * * \- add_point = total_sales_amount_without_tax / point_standard_amount × add_standard_point = 500 / 100 × 1 = 5（切り捨て）
 * * \- promotion_cd: 0100
 * * \- promotion_name: 基準ポイント_Aoca
 * * \- ブランド属性プロモーションが適用されていることを確認する：
 * * * \+ promotion_cd: "brand_attribute"
 * * * \+ promotion_name: "ブランド属性プロモーション"
 * * \- クーポンが発行および使用されていることを確認する：
 * * * \+ add_point = Aoca基準ポイント × coupon.point_standard_rate - Aoca基準ポイント = 5 × 5 - 5 = 20（切り捨て）
 * * * \+ coupon_cd: "brand_attribute"
 * * * \+ coupon_group_cd: "0100"
 * * * \+ point_rate: 5
 * * \- 合計付与ポイントを確認する：
 * * * \+ planning_add_points.total_add_point = Aoca基準ポイント × coupon.point_standard_rate = 5 × 5 = 25（切り捨て）
 * * #### 6.取引完了 `/sales/end`
 * * \- レシートが正しく印字されていることを確認する：
 * * * \+ 商品情報「ブランド属性商品」が含まれている
 * * * \+ ポイント情報「25p」が含まれている
 */
export function TC_011935004_BonusBrand() {
  group("TC_011935004 商品ブランド属性（ボーナスポイントも同様の動き）", () => {
    const step = {
      begin: CommonFunction.getFullDesc(ENDPOINT.SALES_BEGIN),
      barcodeAokiPrepaid: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "Aocaカードスキャン"),
      barcodeBrandAttributePromo: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "ブランド属性商品スキャン"),
      subtotal: CommonFunction.getFullDesc(ENDPOINT.SALES_SUBTOTAL),
      payment: CommonFunction.getFullDesc(ENDPOINT.SALES_ADDPAYMENT),
      end: CommonFunction.getFullDesc(ENDPOINT.SALES_END),
    };

    const pointBrandAttributePromotionStandardRate = 5; // Specified in master m_coupon

    const cartNo = TestHelper.salesBegin(step.begin, {}, [
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
      CHECK.createEqualsCheck({
        name: "Verify customer's Aoca card has information",
        expected: {
          customerCd: CARD.AOKI_PREPAID.CODE,
          pointCardName: CARD.AOKI_PREPAID.NAME,
        },
        actual: (res) => {
          return {
            customerCd: res.result?.cartinfo?.customer?.customer_cd,
            pointCardName: res.result?.cartinfo?.customer?.point_card_name,
          };
        },
      }),
    ], ENVIRONMENT.RETRY_TIMES);

    const totalAddPoint = TestHelper.salesCartBarcode(step.barcodeBrandAttributePromo, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.BRAND_ATTRIBUTE_PROMO,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify cartinfo has ブランド属性商品",
        expected: true,
        actual: (res) => CommonFunction.hasItems([
          PROD.BRAND_ATTRIBUTE_PROMO,
        ], res.result?.cartinfo?.items),
      }),
      CHECK.createEqualsCheck({
        name: "Verify aoca has base points",
        expected: (res) => {
          const standardPointExpected = Formular.calcPointItem({
            cartinfo: res.result?.cartinfo,
            pointStandardAmount: PROMOTION_POINT.AOCA.POINT_STANDARD_AMOUNT,
            addStandardPoint: PROMOTION_POINT.AOCA.ADD_STANDARD_POINT,
          });
          return {
            totalSalesAmountWithoutTax: Formular.calcTotalTaxableAmount(res.result?.cartinfo?.items),
            aocaAddPoint: standardPointExpected,
            aocaPromotionCd: PROMOTION.AOCA.CD,
            aocaPromotionName: PROMOTION.AOCA.NAME,
          };
        },
        actual: (res) => {
          const aocaPointDetail = res.result?.cartinfo?.customer?.planning_add_points?.point_detail?.find(p => p.promotion_cd === PROMOTION.AOCA.CD);
          return {
            totalSalesAmountWithoutTax: res.result?.cartinfo?.total_sales_amount_without_tax,
            aocaAddPoint: aocaPointDetail?.add_point,
            aocaPromotionCd: aocaPointDetail?.promotion_cd,
            aocaPromotionName: aocaPointDetail?.promotion_name,
          };
        },
      }),
      CHECK.createEqualsCheck({
        name: "Verify promotion brand attribute is applied",
        expected: {
          promotionCd: PROMOTION.BRAND_ATTRIBUTE.CD,
          promotionName: PROMOTION.BRAND_ATTRIBUTE.NAME,
        },
        actual: (res) => {
          const pointBrandAttributePointDetail = res.result?.cartinfo?.customer?.planning_add_points?.point_detail?.find(p => p.promotion_cd === PROMOTION.BRAND_ATTRIBUTE.CD);
          return {
            promotionCd: pointBrandAttributePointDetail?.promotion_cd,
            promotionName: pointBrandAttributePointDetail?.promotion_name,
          };
        },
      }),
      CHECK.createEqualsCheck({
        name: "Verify coupon is issued and used",
        expected: (res) => {
          const standardPointExpected = Formular.calcPointItem({
            cartinfo: res.result?.cartinfo,
            pointStandardAmount: PROMOTION_POINT.AOCA.POINT_STANDARD_AMOUNT,
            addStandardPoint: PROMOTION_POINT.AOCA.ADD_STANDARD_POINT,
          });
          return {
            pointBrandAttributeAddPoint: standardPointExpected * (pointBrandAttributePromotionStandardRate - 1),
            pointBrandAttributeCouponCd: COUPON.BRAND_ATTRIBUTE.CD,
            pointBrandAttributeCouponGroupCd: COUPON.BRAND_ATTRIBUTE.GROUP_CD,
            pointBrandAttributePointRate: pointBrandAttributePromotionStandardRate,
          };
        },
        actual: (res) => {
          const pointBrandAttributePointDetail = res.result?.cartinfo?.customer?.planning_add_points?.point_detail?.find(p => p.promotion_cd === PROMOTION.BRAND_ATTRIBUTE.CD);
          return {
            pointBrandAttributeAddPoint: pointBrandAttributePointDetail?.add_point,
            pointBrandAttributeCouponCd: pointBrandAttributePointDetail?.coupon_cd,
            pointBrandAttributeCouponGroupCd: pointBrandAttributePointDetail?.coupon_group_cd,
            pointBrandAttributePointRate: pointBrandAttributePointDetail?.point_rate,
          };
        },
      }),
      CHECK.createEqualsCheck({
        name: "Verify total add points is added",
        expected: (res) => {
          const standardPointExpected = Formular.calcPointItem({
            cartinfo: res.result?.cartinfo,
            pointStandardAmount: PROMOTION_POINT.AOCA.POINT_STANDARD_AMOUNT,
            addStandardPoint: PROMOTION_POINT.AOCA.ADD_STANDARD_POINT,
          });
          return standardPointExpected * pointBrandAttributePromotionStandardRate;
        },
        actual: (res) => res.result?.cartinfo?.customer?.planning_add_points?.total_add_point,
      }),
    ]).result?.cartinfo?.customer?.planning_add_points?.total_add_point;

    const totalBalanceAmount = TestHelper.salesSubtotal(step.subtotal, cartNo, [
      CHECK.createStatusCodeCheck(),
    ]).result?.cartinfo?.total_balance_amount;

    TestHelper.salesAddPayment(step.payment, {
      cartNo,
      paidGroupCode: PAID_METHOD.QRCODE.GROUP_CODE,
      paidCode: PAID_METHOD.QRCODE.PAID_ITEMS.LINE_PAY.PAID_CODE,
      totalBalanceAmount,
      details: ENVIRONMENT.LINEPAY_DETAIL,
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    TestHelper.salesEnd(step.end, {
      cartNo,
      receiptType: RECEIPT_TYPE.NORMAL.VALUE,
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify receipt include information of item: ブランド属性商品 and include information of point",
        expected: true,
        actual: (res) => res.result?.receipts?.some(r =>
          r.receipt_data.includes(PROD.BRAND_ATTRIBUTE_PROMO) &&
          r.receipt_data.includes(totalAddPoint + "p")),
      }),
    ]);
  });
}

/**
 * @function アプリクーポン
 * @memberof ポイント.Aocaポイント
 * @description
 * {@link TAGS.POS}
 * {@link TAGS.POINT}
 * {@link TAGS.SALES}
 * {@link TAGS.AOCA_POINTS}
 * {@link TAGS.SALES_PROMOTION_PLANNED_SALES}
 * {@link TAGS.GRANT}
 * {@link TAGS.USE_APP_COUPON}
 * ### テスト観点
 * * 前提：
 * * * ・アプリクーポンがm_barcodeに設定されている。
 * * * アプリクーポン：m_barcode.barcode_indicator_start=04（TESTｰGA環境にレコードあり）
 * * * ・アプリクーポンが下記のマスタに設定されている
 * * * * →　m_promotion_optional_add_point
 * * * * →　m_promotion_detail_condition
 * * * * →　m_promotion_day_week
 * * * * →　m_promotion_detail_point_card_class
 * * * ・対象商品の特定
 * * * * →　m_promotion_detail_itemに該当商品が登録されている。　→　アプリクーポン対象商品
 * * * ・付与するポイントの情報　　　
 * * * * →　アプリクーポンがm_couponに設定されている。
 * * * * m_coupon.coupon_cd =m_promotion_optional_add_point.coupon_cd
 * * * * m_coupon.coupon_type = ３：ボーナスポイント付与
 * * * * 付与するポイント：m_coupon.bonus_point　
 * * テスト観点：
 * * 公式アプリに表示されるクーポンをスキャンすることで、アプリクーポンが付与される。
 * * * ・アプリクーポン対象商品はアプリクーポンのポイントが付与される。
 * * * ・通常商品はアプリクーポンのポイントが付与されない。
 * 
 * ---
 * ### テスト方法/シナリオ
 * | Step | 手順 | エンドポイント |
 * | :-: | :--- | :--- |
 * | 1 | 取引開始 | `/sales/begin` |
 * | 2 | Aocaカードスキャン | `/sales/cart/barcode` |
 * | 3 | アプリクーポン対象商品スキャン | `/sales/cart/barcode` |
 * | 4 | 通常商品スキャン | `/sales/cart/barcode` |
 * | 5 | 小計 | `/sales/subtotal` |
 * | 6 | 支払登録 | `/sales/addpayment` |
 * | 7 | 取引完了 | `/sales/end` |
 * 
 * ---
 * ### 前提条件
 * * 特になし
 * 
 * ---
 * ### テストデータ
 * * 1.アプリクーポン対象商品: 0441119400000
 * * 2.通常商品: 4500000000121
 * * 3.Promotionアプリクーポン 
 * * \- promotion_cd: 10000020308
 * * \- Coupon setting:
 * * * \+ coupon_cd: 10000020308
 * * * \+ bonus_point: 50
 * 
 * ---
 * ### 期待結果
 * * #### 2.Aocaカードスキャン `/sales/cart/barcode`
 * * \- Aocaカードに以下の情報が含まれていることを確認する：
 * * * \+ customer_cd: 8090227000000006
 * * * \+ point_card_name: "Aoca"
 * * #### 3.アプリクーポン対象商品スキャン `/sales/cart/barcode`
 * * \- カート情報にアプリクーポン対象商品が含まれていることを確認する：
 * * * \+ barcode: 0441119400000
 * * \- アプリクーポンプロモーションが適用されていることを確認する：
 * * * \+ add_point: 50（マスタ設定のbonus_point）
 * * * \+ promotion_cd: 10000020308
 * * * \+ coupon_cd: 10000020308
 * * * \+ coupon_group_cd: 0200
 * * #### 4.通常商品スキャン `/sales/cart/barcode`
 * * \- カート情報に通常商品が含まれていることを確認する：
 * * * \+ barcode: 4500000000121
 * * \- 通常商品には追加ポイントがないことを確認する：
 * * * \+ add_point: 50（マスタ設定のbonus_point）
 * * * \+ promotion_cd: 10000020308
 * * * \+ coupon_cd: 10000020308
 * * #### 6.取引完了 `/sales/end`
 * * \- レシートが正しく印字されていることを確認する：
 * * * \+ 商品情報「アプリクーポン対象商品」が含まれている
 * * * \+ ポイント情報「+50p」が含まれている
 */
export function TC_011935007_ApplyAppCoupon() {
  group("TC_011935007 アプリクーポン", () => {
    const step = {
      begin: CommonFunction.getFullDesc(ENDPOINT.SALES_BEGIN),
      barcodeAokiPrepaid: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "Aocaカードスキャン"),
      barcodeAppCoupon: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "アプリクーポン対象商品スキャン"),
      barcodeRegular: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "通常商品スキャン"),
      subtotal: CommonFunction.getFullDesc(ENDPOINT.SALES_SUBTOTAL),
      payment: CommonFunction.getFullDesc(ENDPOINT.SALES_ADDPAYMENT),
      end: CommonFunction.getFullDesc(ENDPOINT.SALES_END),
    };

    const addPoint = 50; // Specified in master in m_coupon
    const cartNo = TestHelper.salesBegin(step.begin, {
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
      CHECK.createEqualsCheck({
        name: "Verify customer's Aoca card has information",
        expected: {
          customerCd: CARD.AOKI_PREPAID.CODE,
          pointCardName: CARD.AOKI_PREPAID.NAME,
        },
        actual: (res) => {
          return {
            customerCd: res.result?.cartinfo?.customer?.customer_cd,
            pointCardName: res.result?.cartinfo?.customer?.point_card_name,
          };
        },
      }),
    ], ENVIRONMENT.RETRY_TIMES);

    const totalAddPoint = TestHelper.salesCartBarcode(step.barcodeAppCoupon, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.APP_COUPON,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify cartinfo has アプリクーポン対象商品",
        expected: true,
        actual: (res) => CommonFunction.hasItems([
          PROD.APP_COUPON,
        ], res.result?.cartinfo?.items),
      }),
      CHECK.createEqualsCheck({
        name: "Verify promotion app coupon is applied",
        expected: {
          addPoint,
          promotionCd: PROMOTION.APP.CD,
          couponCd: COUPON.APP.CD,
          couponGroupCd: COUPON.APP.GROUP_CD,
        },
        actual: (res) => {
          const appCoupon = res.result?.cartinfo?.customer?.planning_add_points?.point_detail?.find(p => p.promotion_cd === PROMOTION.APP.CD);
          return {
            addPoint: appCoupon?.add_point,
            promotionCd: appCoupon?.promotion_cd,
            couponCd: appCoupon?.coupon_cd,
            couponGroupCd: appCoupon?.coupon_group_cd,
          };
        },
      }),
    ]).result?.cartinfo?.customer?.planning_add_points?.total_add_point;

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
      CHECK.createEqualsCheck({
        name: "Verify cartinfo has 通常商品",
        expected: true,
        actual: (res) => CommonFunction.hasItems([
          PROD.REGULAR,
        ], res.result?.cartinfo?.items),
      }),
      CHECK.createEqualsCheck({
        name: "Verify 通常商品 no additional points",
        expected: {
          addPoint,
          promotionCd: PROMOTION.APP.CD,
          couponCd: COUPON.APP.CD,
        },
        actual: (res) => {
          const appCoupon = res.result?.cartinfo?.customer?.planning_add_points?.point_detail?.find(p => p.promotion_cd === PROMOTION.APP.CD);
          return {
            addPoint: appCoupon?.add_point,
            promotionCd: appCoupon?.promotion_cd,
            couponCd: appCoupon?.coupon_cd,
          };
        },
      }),
    ]);

    const totalBalanceAmount = TestHelper.salesSubtotal(step.subtotal, cartNo, [
      CHECK.createStatusCodeCheck(),
    ]).result?.cartinfo?.total_balance_amount;

    TestHelper.salesAddPayment(step.payment, {
      cartNo,
      paidGroupCode: PAID_METHOD.QRCODE.GROUP_CODE,
      paidCode: PAID_METHOD.QRCODE.PAID_ITEMS.LINE_PAY.PAID_CODE,
      totalBalanceAmount,
      details: ENVIRONMENT.LINEPAY_DETAIL,
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    TestHelper.salesEnd(step.end, {
      cartNo,
      receiptType: RECEIPT_TYPE.NORMAL.VALUE,
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify information of item: アプリクーポン対象商品, 通常商品 and include information of point",
        expected: true,
        actual: (res) => res.result?.receipts?.some(r =>
          r.receipt_data.includes(PROD.APP_COUPON) &&
          r.receipt_data.includes(`+${totalAddPoint}p`)),
      }),
    ]);
  });
}

/**
 * @function 新店オープン時ポイント○倍
 * @memberof 売上.販売促進（企画販売）
 * @description
 * {@link TAGS.POS}
 * {@link TAGS.SALES}
 * {@link TAGS.SALES_PROMOTION_PLANNED_SALES}
 * {@link TAGS.POINTS_AWARDED}
 * {@link TAGS.AOCA_POINTS}
 * {@link TAGS.POINT_MULTIPLIER_UP}
 * ### テスト観点
 * * 新店で対象の商品をお買物した場合、自動的にポイントが○倍になる
 * * 前提：
 * * * ・対象商品を購入する
 * * * * →　店舗01
 * * * * 販促_店舗明細マスタに設定されている店舗が対象店舗
 * * * * →　新店購入ポイント倍増商品
 * * * * 販促_商品明細マスタに設定されている商品が対象商品。
 * * * ・ポイントが○倍で付与される
 * * * * 販促_基準ポイント付与マスタに販促のポイント基準額、付与基準ポイントが設定される。
 * * * * 販促_全体_基準倍率ポイント付与マスタに販促のポイント基準倍率が登録されている。
 * * * ※計算式  
 * * * ・基準ポイント= (ポイント計算対象金額÷ポイント基準額 )×付与基準ポイント
 * * * ・付与ポイント = 付与基準ポイント×ポイント基準倍率
 * * * ポイント計算対象金額について、point_target_flg= falseの支払額が対象外、add_point_tax_handling_typeによって計算式が異なります。
 * * テスト観点：
 * * * ・対象店舗で対象商品を購入すると、ポイントが○倍で付与される
 * 
 * ---
 * ### テスト方法/シナリオ
 * | Step | 手順 | エンドポイント |
 * | :-: | :--- | :--- |
 * | 1 | 取引開始 | `/sales/begin` |
 * | 2 | Aocaカードスキャン | `/sales/cart/barcode` |
 * | 3 | 新店購入ポイント倍増商品スキャン | `/sales/cart/barcode` |
 * | 4 | ポイント倍対象外商品スキャン | `/sales/cart/barcode` |
 * | 5 | 小計 | `/sales/subtotal` |
 * | 6 | 支払登録 | `/sales/addpayment` |
 * | 7 | 取引完了 | `/sales/end` |
 * 
 * ---
 * ### 前提条件
 * * 特になし
 * 
 * ---
 * ### テストデータ
 * * 1.新店購入ポイント倍増商品 : 4520230413114.
 * * 2.ポイント倍対象外商品: 4520230413101
 * * 3.promotion 基準ポイント_Aoca: 
 * * \- point_standard_amount: 100
 * * \- add_standard_point: 1
 * * (設定:  買い物の100 円ごとで  +1ポイント )
 * * 4.promotion 新店オープンポイント3倍
 * * \- promotion_cd: new_store_3x_point
 * * \- promotion_name: 新店オープンポイント3倍
 * * \- point_standard_rate: 3
 * 
 * ---
 * ### 期待結果
 * * #### 2.Aocaカードスキャン `/sales/cart/barcode`
 * * \- 顧客のAocaカードに以下の情報が含まれていることを確認する：
 * * * \+ customer_cd: 8090227000000006
 * * * \+ point_card_name: "Aoca"
 * * #### 3.新店購入ポイント倍増商品スキャン `/sales/cart/barcode`
 * * \- カート情報に以下の商品が含まれていることを確認する：
 * * * \+ barcode: 4520230413114
 * * \- total_sales_amount_without_tax = display_unit_price × quantity = 200 × 1 = 200 であることを確認する。
 * * \- 新店購入ポイント倍増商品がポイントを獲得していることを確認する：
 * * * \+ planning_add_points.total_add_point = total_sales_amount_without_tax / point_standard_amount × point_standard_rate（3倍） = 200 / 100 × 3 = 6（切り捨て）
 * * * \+ プロモーション「基準ポイント_Aoca」：
 * * \- add_point = total_sales_amount_without_tax / point_standard_amount × add_standard_point = 200 / 100 × 1 = 2（切り捨て）
 * * \- promotion_cd: 0100
 * * \- promotion_name: 基準ポイント_Aoca
 * * * \+ プロモーション「新店オープンポイント3倍」：
 * * \- add_point = 基準ポイント_Aocaのadd_point × point_standard_rate - 基準ポイント_Aocaのadd_point = 2 × 3 - 2 = 4（切り捨て）
 * * \- promotion_cd: "new_store_3x_point"
 * * \- promotion_name: "新店オープンポイント3倍"
 * * #### 4.ポイント倍対象外商品スキャン `/sales/cart/barcode`
 * * \- ポイント倍対象外商品に以下の情報が含まれていることを確認する：
 * * * \+ barcode: 4520230413101
 * * \- ポイント倍対象外商品に追加ポイントがないことを確認する：
 * * * \+ planning_add_points.total_add_point = 前ステップ（3）のtotal_add_point = 6
 * * #### 7.取引完了 `/sales/end`
 * * \- レシートが正しく印字されていることを確認する：
 * * * \+ 商品情報「新店購入ポイント倍増商品」と「ポイント倍対象外商品」が含まれている
 * * * \+ ポイント情報「6p」が含まれている
 */
export function TC_011935008_BonusPointNewStore() {
  group("TC_011935008 新店オープン時ポイント○倍", () => {
    const step = {
      begin: CommonFunction.getFullDesc(ENDPOINT.SALES_BEGIN),
      barcodeAokiPrepaid: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "Aocaカードスキャン"),
      barcodeNewStore3xPoint: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "新店購入ポイント倍増商品スキャン"),
      barcodeUnMultiplyPoints: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "ポイント倍対象外商品スキャン"),
      subtotal: CommonFunction.getFullDesc(ENDPOINT.SALES_SUBTOTAL),
      payment: CommonFunction.getFullDesc(ENDPOINT.SALES_ADDPAYMENT),
      end: CommonFunction.getFullDesc(ENDPOINT.SALES_END),
    };

    const pointStandardRateNewStore3X = 3; // Specified in master m_promotion_all_add_standard_rate_point

    const cartNo = TestHelper.salesBegin(step.begin, {
      operateEmployeeCd: ENVIRONMENT.EMPLOYEE_BARCODE,
      isSelf: false,
      terminalId: ENVIRONMENT.TERMINAL_ID,
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
      CHECK.createEqualsCheck({
        name: "Verify customer's Aoca card has information",
        expected: {
          customerCd: CARD.AOKI_PREPAID.CODE,
          pointCardName: CARD.AOKI_PREPAID.NAME,
        },
        actual: (res) => {
          return {
            customerCd: res.result?.cartinfo?.customer?.customer_cd,
            pointCardName: res.result?.cartinfo?.customer?.point_card_name,
          };
        },
      }),
    ], ENVIRONMENT.RETRY_TIMES);

    const totalAddPoint = TestHelper.salesCartBarcode(step.barcodeNewStore3xPoint, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.NEW_STORE_3X_POINT,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify cartinfo has 新店購入ポイント倍増商品",
        expected: true,
        actual: (res) => CommonFunction.hasItems([
          PROD.NEW_STORE_3X_POINT,
        ], res.result?.cartinfo?.items),
      }),
      CHECK.createEqualsCheck({
        name: "Verify total sales amount without tax",
        expected: (res) => Formular.calcTotalTaxableAmount(res.result?.cartinfo?.items),
        actual: (res) => res.result?.cartinfo?.total_sales_amount_without_tax,
      }),
      CHECK.createEqualsCheck({
        name: "Verify 新店購入ポイント倍増商品 gets points",
        expected: (res) => {
          const standardPointExpected = Formular.calcPointItem({
            cartinfo: res.result?.cartinfo,
            pointStandardAmount: PROMOTION_POINT.AOCA.POINT_STANDARD_AMOUNT,
            addStandardPoint: PROMOTION_POINT.AOCA.ADD_STANDARD_POINT,
          });
          return {
            totalAddPoint: standardPointExpected * pointStandardRateNewStore3X,
            aocaAddPoint: standardPointExpected,
            aocaPromotionCd: PROMOTION.AOCA.CD,
            aocaPromotionName: PROMOTION.AOCA.NAME,
            pointNewStore3XPoint: standardPointExpected * (pointStandardRateNewStore3X - 1),
            pointNewStore3XCd: PROMOTION.NEW_STORE_3X_POINT.CD,
            pointNewStore3XName: PROMOTION.NEW_STORE_3X_POINT.NAME,
          };
        },
        actual: (res) => {
          const aocaPointDetail = res.result?.cartinfo?.customer?.planning_add_points?.point_detail?.find(p => p.promotion_cd === PROMOTION.AOCA.CD);
          const pointNewStore3XDetail = res.result?.cartinfo?.customer?.planning_add_points?.point_detail?.find(p => p.promotion_cd === PROMOTION.NEW_STORE_3X_POINT.CD);
          return {
            totalAddPoint: res.result?.cartinfo?.customer?.planning_add_points?.total_add_point,
            aocaAddPoint: aocaPointDetail?.add_point,
            aocaPromotionCd: aocaPointDetail?.promotion_cd,
            aocaPromotionName: aocaPointDetail?.promotion_name,
            pointNewStore3XPoint: pointNewStore3XDetail?.add_point,
            pointNewStore3XCd: pointNewStore3XDetail?.promotion_cd,
            pointNewStore3XName: pointNewStore3XDetail?.promotion_name,
          };
        },
      }),
    ]).result?.cartinfo?.customer?.planning_add_points?.total_add_point;

    TestHelper.salesCartBarcode(step.barcodeUnMultiplyPoints, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.UN_MULTIPLY_POINTS,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify cartinfo has ポイント倍対象外商品",
        expected: true,
        actual: (res) => CommonFunction.hasItems([
          PROD.UN_MULTIPLY_POINTS,
        ], res.result?.cartinfo?.items),
      }),
      CHECK.createEqualsCheck({
        name: "Verify ポイント倍対象商品 no additional points",
        expected: totalAddPoint,
        actual: (res) => res.result?.cartinfo?.customer?.planning_add_points?.total_add_point,
      }),
    ]);

    const totalBalanceAmount = TestHelper.salesSubtotal(step.subtotal, cartNo, [
      CHECK.createStatusCodeCheck(),
    ]).result?.cartinfo?.total_balance_amount;

    TestHelper.salesAddPayment(step.payment, {
      cartNo,
      paidGroupCode: PAID_METHOD.QRCODE.GROUP_CODE,
      paidCode: PAID_METHOD.QRCODE.PAID_ITEMS.LINE_PAY.PAID_CODE,
      totalBalanceAmount,
      details: ENVIRONMENT.LINEPAY_DETAIL,
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    TestHelper.salesEnd(step.end, {
      cartNo,
      receiptType: RECEIPT_TYPE.NORMAL.VALUE,
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify information of 2 item: 新店購入ポイント倍増商品, ポイント倍対象外商品 and include information of point",
        expected: true,
        actual: (res) => res.result?.receipts?.some(r =>
          r.receipt_data.includes(PROD.NEW_STORE_3X_POINT) &&
          r.receipt_data.includes(PROD.UN_MULTIPLY_POINTS) &&
          r.receipt_data.includes(totalAddPoint + "p")),
      }),
    ]);
  });
}

/**
 * @function 新店オープン時ポイント○倍（他のポイント倍率施策と重なる）
 * @memberof 売上.販売促進（企画販売）
 * @description
 * {@link TAGS.POS}
 * {@link TAGS.SALES}
 * {@link TAGS.SALES_PROMOTION_PLANNED_SALES}
 * {@link TAGS.POINTS_AWARDED}
 * {@link TAGS.AOCA_POINTS}
 * {@link TAGS.POINT_MULTIPLIER_UP}
 * ### テスト観点
 * * 前提：
 * * * ・新店および販促対象外店舗で対象対象商品を購入する
 * * * * →　店舗01（販促対象）
 * * * * 販促_店舗明細マスタに設定されている店舗
 * * * * →　店舗02（販促対象外）
 * * * * 販促_店舗明細マスタに設定されていない店舗
 * * * * →　新店購入・日曜日ポイント倍付商品
 * * * * 販促_商品明細マスタに設定されている商品が対象商品。
 * * * ・企画に設定された特定の曜日に、特定のポイント倍率を適用する
 * * * * →　日曜日
 * * * * 販促_曜日マスタに日曜販促有効フラグがTrueで設定されていること（店舗／販促ごと）
 * * * ・高い倍率が適用される
 * * * * 販促_基準ポイント付与マスタに販促のポイント基準額、付与基準ポイントが設定される。
 * * * * 販促_全体_基準倍率ポイント付与マスタに販促のポイント基準倍率が登録されている。
 * * * ※計算式  
 * * * ・基準ポイント= (ポイント計算対象金額÷ポイント基準額 )×付与基準ポイント
 * * * ・付与ポイント = 付与基準ポイント×ポイント基準倍率
 * * * ポイント計算対象金額について、point_target_flg= falseの支払額が対象外、add_point_tax_handling_typeによって計算式が異なります。
 * * テスト観点：
 * * * ・日曜日に対象店舗で対象商品を購入すると、ポイント高い倍率の販促が適用され、ポイント付与される
 * * * ・店舗01と店舗02では違う倍率でポイントが付与されることを確認
 * 
 * ---
 * ### テスト方法/シナリオ
 * | Step | 手順 | エンドポイント |
 * | :-: | :--- | :--- |
 * | - | 取引1: 店舗01（販促対象） | - |
 * | 0.1 | - | `/authorization` |
 * | 0.2 | - | `/signin` |
 * | 1 | 取引開始 | `/sales/begin` |
 * | 2 | Aocaカードスキャン | `/sales/cart/barcode` |
 * | 3 | 新店購入・日曜日ポイント倍付商品スキャン | `/sales/cart/barcode` |
 * | 4 | 小計 | `/sales/subtotal` |
 * | 5 | 支払登録 | `/sales/addpayment` |
 * | 6 | 取引完了 | `/sales/end` |
 * | - | 取引2: 店舗02（販促対象外） | - |
 * | 0.3 | - | `/authorization` |
 * | 0.4 | - | `/signin` |
 * | 7 | 取引開始 | `/sales/begin` |
 * | 8 | Aocaカードスキャン | `/sales/cart/barcode` |
 * | 9 | 新店購入・日曜日ポイント倍付商品スキャン | `/sales/cart/barcode` |
 * | 10 | 小計 | `/sales/subtotal` |
 * | 11 | 支払登録 | `/sales/addpayment` |
 * | 12 | 取引完了 | `/sales/end` |
 * 
 * ---
 * ### 前提条件
 * * 店舗02（販促対象外）のstore_cd:"0081"はKeyCloakに設定された事
 * 
 * ---
 * ### テストデータ
 * * 1.新店購入・日曜日ポイント倍付商品: 4520230413115
 * * 2.プロモーションの 基準ポイント_Aoca:
 * * \- point_standard_amount: 100
 * * \- add_standard_point: 1 (設定：100円購入すると +1ポイント)
 * * 3.プロモーションの 新店日曜ポイント6倍
 * * \- promotion_cd: ns_6x_sun
 * * \- promotion_name: 新店日曜ポイント6倍
 * * \- point_standard_rate: 6
 * * 4.store_cd: 0080（販促対象店舗）
 * * \- user_cd: pos_user_01
 * * \- password: pos_user_01
 * * 5.store_cd: 0081（販促対象外店舗）
 * * \- user_cd: pos_user_04
 * * \- password: pos_user_04
 * * \- terminal_id: 6408904008001
 * 
 * ---
 * ### 期待結果
 * * 取引1: 店舗1（販促対象）
 * * #### 2. Aocaカードスキャン `/sales/cart/`バーコード
 * * \- 顧客のAocaカード情報を確認:
 * * * \+ customer_cd: 8090227000000006
 * * * \+ point_card_name: "Aoca"
 * * #### 3. 新店購入・日曜日ポイント倍付商品スキャン `/sales/cart/`バーコード
 * * \- カート情報に新店購入・日曜日ポイント倍付商品が含まれていることを確認:
 * * * \+ バーコード: 4520230413115
 * * \- 税抜売上金額が display_unit_price × quantity = 200 × 1 = 200 であることを確認
 * * \- 新店購入・日曜日ポイント倍付商品のポイント付与を確認:
 * * * \+ planning_add_points.total_add_point =
 * * * *    total_sales_amount_without_tax / point_standard_amount × point_standard_rate(6倍)
 * * * *    = 200 / 100 × 6 = 12（切り捨て）
 * * * \+ プロモーションの"基準ポイント_Aoca":
 * * \- add_point =
 * * * *  total_sales_amount_without_tax / point_standard_amount × add_standard_point
 * * * *  = 200 / 100 × 1 = 2（切り捨て）
 * * \- promotion_cd: 0100
 * * \- promotion_name: 基準ポイント_Aoca
 * * \- point_rate: 1（マスタ設定 add_standard_point）
 * * * \+ プロモーションの新店日曜ポイント6倍:
 * * \- add_point =
 * * * *  基準ポイント_Aoca addPoint × point_standard_rate - 基準ポイント_Aoca addPoint
 * * * *  = 2 × 6 - 2 = 10（切り捨て）
 * * \- promotion_cd: "ns_6x_sun"
 * * \- promotion_name: "新店日曜ポイント6倍"
 * * \- point_rate: 6（マスタ設定 point_standard_rate）
 * * #### 6. 取引完了 `/sales/end`
 * * \- レシートが正しく印刷されること:
 * * * \+ 商品情報を含む: 新店購入・日曜日ポイント倍付商品
 * * * \+ ポイント倍率を含む: 6倍
 * * * \+ ポイント情報を含む: 12p
 * * 取引2: 店舗2（販促対象外）
 * * #### 8. Aocaカードスキャン `/sales/cart/`バーコード
 * * \- 顧客のAocaカード情報を確認:
 * * * \+ customer_cd: 8090227000000006
 * * * \+ point_card_name: "Aoca"
 * * #### 9. 新店購入・日曜日ポイント倍付商品スキャン `/sales/cart/`バーコード
 * * \- カート情報に新店購入・日曜日ポイント倍付商品が含まれていることを確認:
 * * * \+ バーコード: 4520230413115
 * * \- 税抜売上金額が display_unit_price × quantity = 200 × 1 = 200 であることを確認
 * * \- 新店購入・日曜日ポイント倍付商品のポイント付与を確認:
 * * * \+ planning_add_points.total_add_point =
 * * * *    total_sales_amount_without_tax / point_standard_amount × add_standard_point
 * * * *    = 200 / 100 = 2（切り捨て）
 * * * \+ プロモーションの"基準ポイント_Aoca":
 * * \- add_point =
 * * * *  total_sales_amount_without_tax / point_standard_amount × add_standard_point
 * * * *  = 200 / 100 × 1 = 2（切り捨て）
 * * \- promotion_cd: 0100
 * * \- promotion_name: 基準ポイント_Aoca
 * * \- point_rate: 1（マスタ設定）
 * * \- 合計付与ポイントが Step 3 の total_add_point と一致しないことを確認
 */
export function TC_011935009_BonusPointNewStoreSunday() {
  group("TC_011935009 新店オープン時ポイント○倍（他のポイント倍率施策と重なる）", () => {
    const step = {
      auth1: CommonFunction.getFullDesc(ENDPOINT.AUTHORIZATION, `${ENDPOINT.AUTHORIZATION.desc} (Store 1)`),
      signIn1: CommonFunction.getFullDesc(ENDPOINT.SIGNIN, `${ENDPOINT.SIGNIN.desc} サインイン (Store 1)`),
      begin1: CommonFunction.getFullDesc(ENDPOINT.SALES_BEGIN, `${ENDPOINT.SALES_BEGIN.desc} (Store 1)`),
      barcodeAokiPrepaid1: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "Aocaカードスキャン (Store 1)"),
      barcodeNewStoreSunday6XPoint1: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "新店購入・日曜日ポイント倍付商品スキャン (Store 1)"),
      subtotal1: CommonFunction.getFullDesc(ENDPOINT.SALES_SUBTOTAL, `${ENDPOINT.SALES_SUBTOTAL.desc} (Store 1)`),
      payment1: CommonFunction.getFullDesc(ENDPOINT.SALES_ADDPAYMENT, `${ENDPOINT.SALES_ADDPAYMENT.desc} (Store 1)`),
      end1: CommonFunction.getFullDesc(ENDPOINT.SALES_END, `${ENDPOINT.SALES_END.desc} (Store 1)`),
      auth2: CommonFunction.getFullDesc(ENDPOINT.AUTHORIZATION, `${ENDPOINT.AUTHORIZATION.desc} (Store 2)`),
      signIn2: CommonFunction.getFullDesc(ENDPOINT.SIGNIN, `${ENDPOINT.SIGNIN.desc} サインイン (Store 2)`),
      begin2: CommonFunction.getFullDesc(ENDPOINT.SALES_BEGIN, `${ENDPOINT.SALES_BEGIN.desc} (Store 2)`),
      barcodeAokiPrepaid2: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "Aocaカードスキャン (Store 2)"),
      barcodeNewStoreSunday6XPoint2: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "新店購入・日曜日ポイント倍付商品スキャン (Store 2)"),
      subtotal2: CommonFunction.getFullDesc(ENDPOINT.SALES_SUBTOTAL, `${ENDPOINT.SALES_SUBTOTAL.desc} (Store 2)`),
      payment2: CommonFunction.getFullDesc(ENDPOINT.SALES_ADDPAYMENT, `${ENDPOINT.SALES_ADDPAYMENT.desc} (Store 2)`),
      end2: CommonFunction.getFullDesc(ENDPOINT.SALES_END, `${ENDPOINT.SALES_END.desc} (Store 2)`),
    };

    const pointStandardAoca = PROMOTION_POINT.AOCA.ADD_STANDARD_POINT;
    const pointStandardRateNewStore6XSun = 6; // Specified in master m_promotion_all_add_standard_rate_point

    // Transaction at store 1
    TestHelper.auth(step.auth1, {
      clientId: ENVIRONMENT.CLIENT_ID,
      userCd: ENVIRONMENT.USER_CD,
      userPassword: ENVIRONMENT.USER_PASSWORD,
      realm: ENVIRONMENT.REALM,
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    sleep(3);

    TestHelper.signin(step.signIn1, ENVIRONMENT.EMPLOYEE_BARCODE, [
      CHECK.createStatusCodeCheck(),
    ]);

    let cartNo = TestHelper.salesBegin(step.begin1, {
      operateEmployeeCd: ENVIRONMENT.EMPLOYEE_BARCODE,
      isSelf: false,
      terminalId: ENVIRONMENT.TERMINAL_ID,
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    TestHelper.salesCartBarcode(step.barcodeAokiPrepaid1, {
      cartNo,
      barcodes: [
        {
          barcode: CARD.AOKI_PREPAID.CODE,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify customer's Aoca card has information",
        expected: {
          customerCd: CARD.AOKI_PREPAID.CODE,
          pointCardName: CARD.AOKI_PREPAID.NAME,
        },
        actual: (res) => {
          return {
            customerCd: res.result?.cartinfo?.customer?.customer_cd,
            pointCardName: res.result?.cartinfo?.customer?.point_card_name,
          };
        },
      }),
    ], ENVIRONMENT.RETRY_TIMES);

    const totalAddPointStore1 = TestHelper.salesCartBarcode(step.barcodeNewStoreSunday6XPoint1, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.NEW_STORE_SUNDAY_6X_POINT,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify cartinfo has 新店購入・日曜日ポイント倍付商品",
        expected: true,
        actual: (res) => CommonFunction.hasItems([
          PROD.NEW_STORE_SUNDAY_6X_POINT,
        ], res.result?.cartinfo?.items),
      }),
      CHECK.createEqualsCheck({
        name: "Verify total sales amount without tax",
        expected: (res) => Formular.calcTotalTaxableAmount(res.result?.cartinfo?.items),
        actual: (res) => res.result?.cartinfo?.total_sales_amount_without_tax,
      }),
      CHECK.createEqualsCheck({
        name: "Verify 新店購入・日曜日ポイント倍付商品 gets points",
        expected: (res) => {
          const standardPointExpected = Formular.calcPointItem({
            cartinfo: res.result?.cartinfo,
            pointStandardAmount: PROMOTION_POINT.AOCA.POINT_STANDARD_AMOUNT,
            addStandardPoint: PROMOTION_POINT.AOCA.ADD_STANDARD_POINT,
          });
          return {
            totalAddPoint: standardPointExpected * pointStandardRateNewStore6XSun,
            aocaAddPoint: standardPointExpected,
            aocaPromotionCd: PROMOTION.AOCA.CD,
            aocaPromotionName: PROMOTION.AOCA.NAME,
            aocaPromotionPointRate: pointStandardAoca,
            pointNewStore6XSunPoint: standardPointExpected * (pointStandardRateNewStore6XSun - 1),
            pointNewStore6XSunCd: PROMOTION.NEW_STORE_6X_SUN.CD,
            pointNewStore6XSunName: PROMOTION.NEW_STORE_6X_SUN.NAME,
            pointNewStore6XSunPointRate: pointStandardRateNewStore6XSun,
          };
        },
        actual: (res) => {
          const aocaPointDetail = res.result?.cartinfo?.customer?.planning_add_points?.point_detail?.find(p => p.promotion_cd === PROMOTION.AOCA.CD);
          const pointNewStore6XSunDetail = res.result?.cartinfo?.customer?.planning_add_points?.point_detail?.find(p => p.promotion_cd === PROMOTION.NEW_STORE_6X_SUN.CD);
          return {
            totalAddPoint: res.result?.cartinfo?.customer?.planning_add_points?.total_add_point,
            aocaAddPoint: aocaPointDetail?.add_point,
            aocaPromotionCd: aocaPointDetail?.promotion_cd,
            aocaPromotionName: aocaPointDetail?.promotion_name,
            aocaPromotionPointRate: aocaPointDetail?.point_rate,
            pointNewStore6XSunPoint: pointNewStore6XSunDetail?.add_point,
            pointNewStore6XSunCd: pointNewStore6XSunDetail?.promotion_cd,
            pointNewStore6XSunName: pointNewStore6XSunDetail?.promotion_name,
            pointNewStore6XSunPointRate: pointNewStore6XSunDetail?.point_rate,
          };
        },
      }),
    ]).result?.cartinfo?.customer?.planning_add_points?.total_add_point;

    let totalBalanceAmount = TestHelper.salesSubtotal(step.subtotal1, cartNo, [
      CHECK.createStatusCodeCheck(),
    ]).result?.cartinfo?.total_balance_amount;

    TestHelper.salesAddPayment(step.payment1, {
      cartNo,
      paidGroupCode: PAID_METHOD.QRCODE.GROUP_CODE,
      paidCode: PAID_METHOD.QRCODE.PAID_ITEMS.LINE_PAY.PAID_CODE,
      totalBalanceAmount,
      details: ENVIRONMENT.LINEPAY_DETAIL,
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    TestHelper.salesEnd(step.end1, {
      cartNo,
      receiptType: RECEIPT_TYPE.NORMAL.VALUE,
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify information: 新店購入・日曜日ポイント倍付商品, point multiplier and total add point",
        expected: true,
        actual: (res) => CommonFunction.checkReceiptData([
          PROD.NEW_STORE_SUNDAY_6X_POINT,
          `${pointStandardRateNewStore6XSun}倍`,
          `${totalAddPointStore1}p`,
        ], res.result?.receipts),
      }),
    ]);

    // Transaction at store 2
    TestHelper.auth(step.auth2, {
      clientId: ENVIRONMENT.CLIENT_ID,
      userCd: ENVIRONMENT.USER_CD_04,
      userPassword: ENVIRONMENT.USER_PASSWORD_04,
      realm: ENVIRONMENT.REALM,
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    sleep(3);

    TestHelper.signin(step.signIn2, ENVIRONMENT.EMPLOYEE_BARCODE, [
      CHECK.createStatusCodeCheck(),
    ]);

    cartNo = TestHelper.salesBegin(step.begin2, {
      operateEmployeeCd: ENVIRONMENT.EMPLOYEE_BARCODE,
      isSelf: false,
      terminalId: ENVIRONMENT.TERMINAL_ID,
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    TestHelper.salesCartBarcode(step.barcodeAokiPrepaid2, {
      cartNo,
      barcodes: [
        {
          barcode: CARD.AOKI_PREPAID.CODE,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify customer's Aoca card has information",
        expected: {
          customerCd: CARD.AOKI_PREPAID.CODE,
          pointCardName: CARD.AOKI_PREPAID.NAME,
        },
        actual: (res) => {
          return {
            customerCd: res.result?.cartinfo?.customer?.customer_cd,
            pointCardName: res.result?.cartinfo?.customer?.point_card_name,
          };
        },
      }),
    ], ENVIRONMENT.RETRY_TIMES);

    TestHelper.salesCartBarcode(step.barcodeNewStoreSunday6XPoint2, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.NEW_STORE_SUNDAY_6X_POINT,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify cartinfo has 新店購入・日曜日ポイント倍付商品",
        expected: true,
        actual: (res) => CommonFunction.hasItems([
          PROD.NEW_STORE_SUNDAY_6X_POINT,
        ], res.result?.cartinfo?.items),
      }),
      CHECK.createEqualsCheck({
        name: "Verify total sales amount without tax",
        expected: (res) => Formular.calcTotalTaxableAmount(res.result?.cartinfo?.items),
        actual: (res) => res.result?.cartinfo?.total_sales_amount_without_tax,
      }),
      CHECK.createEqualsCheck({
        name: "Verify 新店購入・日曜日ポイント倍付商品 gets points",
        expected: (res) => {
          const standardPointExpected = Formular.calcPointItem({
            cartinfo: res.result?.cartinfo,
            pointStandardAmount: PROMOTION_POINT.AOCA.POINT_STANDARD_AMOUNT,
            addStandardPoint: PROMOTION_POINT.AOCA.ADD_STANDARD_POINT,
          });
          return {
            aocaAddPoint: standardPointExpected,
            aocaPromotionCd: PROMOTION.AOCA.CD,
            aocaPromotionName: PROMOTION.AOCA.NAME,
            aocaPromotionPointRate: pointStandardAoca,
          };
        },
        actual: (res) => {
          const aocaPointDetail = res.result?.cartinfo?.customer?.planning_add_points?.point_detail?.find(p => p.promotion_cd === PROMOTION.AOCA.CD);
          return {
            aocaAddPoint: aocaPointDetail?.add_point,
            aocaPromotionCd: aocaPointDetail?.promotion_cd,
            aocaPromotionName: aocaPointDetail?.promotion_name,
            aocaPromotionPointRate: aocaPointDetail?.point_rate,
          };
        },
      }),
      CHECK.createEqualsCheck({
        name: "Verify total add point is not equal to transaction at store 1",
        expected: true,
        actual: (res) => totalAddPointStore1 !== res.result?.cartinfo?.customer?.planning_add_points?.total_add_point,
      }),
    ]);

    totalBalanceAmount = TestHelper.salesSubtotal(step.subtotal2, cartNo, [
      CHECK.createStatusCodeCheck(),
    ]).result?.cartinfo?.total_balance_amount;

    TestHelper.salesAddPayment(step.payment2, {
      cartNo,
      paidGroupCode: PAID_METHOD.QRCODE.GROUP_CODE,
      paidCode: PAID_METHOD.QRCODE.PAID_ITEMS.LINE_PAY.PAID_CODE,
      totalBalanceAmount,
      details: ENVIRONMENT.LINEPAY_DETAIL,
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    TestHelper.salesEnd(step.end2, {
      cartNo,
      receiptType: RECEIPT_TYPE.NORMAL.VALUE,
    }, [
      CHECK.createStatusCodeCheck(),
    ]);
  });
}
