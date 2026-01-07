import * as CHECK from "../../../common/common_check.js";
import * as ENDPOINT from "../../../common/endpoint_const.js";
import * as ENVIRONMENT from "../../../common/environment_const.js";
import { group } from "k6";
import * as PROD from "../../../common/constant/product.js";
import { PAID_METHOD } from "../../../common/constant/paid_methods.js";
import { CARD } from "../../../common/constant/card.js";
import { CommonFunction } from "../../../common/common_function.js";
import { TestHelper } from "../../../common/test_helper.js";
import { PROMOTION } from "../../../common/constant/promotion.js";
import * as TAGS from "../../../tags/tags_const.js";

/**
 * @function アオキクーポン（超トク）の値引パターン
 * @memberof 売上.販売促進（企画販売）
 * @description
 * {@link TAGS.POS}
 * {@link TAGS.SALES}
 * {@link TAGS.SALES_PROMOTION_PLANNED_SALES}
 * {@link TAGS.AOCA_POINTS}
 * {@link TAGS.AFTER_COUPON_DISCOUNT}
 * ### テスト観点
 * * 前提：
 * * * ・アオキクーポン（超トク）がm_promotion_issue_voucherに設定されている。
 * * * ・アオキクーポン（超トク）がm_voucherに設定されている。
 * * * ・販促A：m_promotion_issue_voucher.issue_same_multiple_voucher_flg = True
 * * * * 同一金券複数枚発券あり(1取引で条件成立毎に繰り返し発券)
 * * * ・販促B：m_promotion_issue_voucher.issue_same_multiple_voucher_flg = False
 * * * * 同一金券複数枚発券なし(1取引で条件成立で1回発券)
 * * * ・金券額面（値引額）はm_voucher.face_valueを使用する。
 * * * ・超トク対象商品 は販促Aのm_promotion_detail_itemに設定されている。
 * * * ・販促商品 は販促Bのm_promotion_detail_itemに設定されている。
 * * * ・非販促商品はm_promotion_detail_itemに設定されていない。
 * * テスト観点：
 * * アオキクーポン（超トク）という企画で設定された商品登録を行うと値引が適用される。
 * * * ・超トク対象商品は2件とも値引が適用される。
 * * * m_promotion_issue_voucher.issue_same_multiple_voucher_flg = Trueのため。
 * * * ・販促商品は1件のみ値引が適用され、もう1件は値引されない（通常価格）。
 * * * m_promotion_issue_voucher.issue_same_multiple_voucher_flg = Falseのため。
 * * * ・非販促商品は値引が適用されない。（販促_商品明細マスタに登録されていない商品）
 * 
 * ---
 * ### テスト方法/シナリオ
 * | Step | 手順 | エンドポイント |
 * | :-: | :--- | :--- |
 * | 1 | 取引開始 | `/sales/begin` |
 * | 2 | Aocaカードスキャン | `/sales/cart/barcode` |
 * | 3 | 超トク対象商品スキャン (１回目) | `/sales/cart/barcode` |
 * | 4 | 超トク対象商品スキャン (２回目) | `/sales/cart/barcode` |
 * | 5 | 販促商品スキャン (１回目) | `/sales/cart/barcode` |
 * | 6 | 販促商品スキャン (２回目) | `/sales/cart/barcode` |
 * | 7 | 非販促商品スキャン | `/sales/cart/barcode` |
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
 * * 1.超トク対象商品 : 4500000000077
 * * 2.販促商品 : 4911110703004
 * * ※　該当Sheetテストデータの名称：
 * * 超トク対象商品(PROD.super_bargain_2)
 * * 3.非販促商品: T4500000000032
 * * ※　該当Sheetテストデータの名称：
 * * 販促商品 (PROD.regular_promotion) 
 * * 4.超得クーポン（即時利用) :
 * * promotion_cd = 15604 & 15605
 * * 5.クスリのアオキプリペイドカード: 8090227000000006 (Aok card)
 * * \---
 * 
 * ---
 * ### 期待結果
 * * 実行時、テスト観点通り稼働していない。
 * * Step 6 の販促商品は　販促Bに適用されている。
 * * * \+ voucher_discount_detail_list.promotion_cd = 15605
 * * * \+ voucher_discount_detail_list.promotion_name= "超得クーポン（即時利用）2"
 * * * \+ voucher_discount_detail_list.face_value=  100
 * * \---
 * * #### 2.Aocaカードスキャン `/sales/cart/barcode`
 * * \- Aocaカードのスキャンが成功かどうか確認
 * * * \+ customer_cd = "8090227000000006"
 * * * \+ point_card_name = "Aoca"
 * * #### 3.超トク対象商品　スキャン `/sales/cart/barcode`
 * * \-  超トク対象商品の情報を確認
 * * * \+ barcode: 4500000000077
 * * * \+ unit_price: 1000
 * * * \+ display_unit_price: 1000
 * * * \+ tax_rate: 8
 * * \- 超トク対象商品は販促Aに適用されたか確認
 * * * \+ voucher_discount_detail_list.promotion_cd = 15604
 * * * \+ voucher_discount_detail_list.promotion_name= "超得クーポン（即時利用）"
 * * * \+ voucher_discount_detail_list.face_value=  100
 * * #### 4.超トク対象商品　スキャン `/sales/cart/barcode`
 * * \-  超トク対象商品の情報を確認
 * * * \+ barcode: 4500000000077
 * * * \+ unit_price: 1000
 * * * \+ display_unit_price: 1000
 * * * \+ tax_rate: 8
 * * \- 超トク対象商品　は販促Aに適用されたか確認
 * * * \+ voucher_discount_detail_list.promotion_cd = 15604
 * * * \+ voucher_discount_detail_list.promotion_name= "超得クーポン（即時利用）"
 * * * \+ voucher_discount_detail_list.face_value=  100
 * * #### 5.販促商品　スキャン `/sales/cart/barcode`
 * * \- カートInfoに商品がある確認
 * * * \+ barcode: 4911110703004
 * * * \+ unit_price: 1408
 * * * \+ display_unit_price: 1408
 * * * \+ tax_rate: 10
 * * \- 販促商品　は販促Bに適用されたか確認
 * * * \+ voucher_discount_detail_list.promotion_cd = 15605
 * * * \+ voucher_discount_detail_list.promotion_name= "超得クーポン（即時利用）2"
 * * * \+ voucher_discount_detail_list.face_value=  100
 * * #### 6.販促商品　スキャン `/sales/cart/barcode`
 * * \- カートInfoに商品Bがあるか確認
 * * * \+ barcode: 4911110703004
 * * * \+ unit_price: 1408
 * * * \+ display_unit_price: 1408
 * * * \+ tax_rate: 10
 * * \- 販促商品　は販促Bに適用されないか確認
 * * * \+ voucher_discount_detail_list= []
 * * 7.非販促商品　スキャン 
 * * \- 非販促商品の情報を確認:
 * * * \+ barcode: 4500000000032
 * * * \+ unit_price: 300
 * * * \+ display_unit_price: 300
 * * * \+ tax_rate: 8
 * * \- 非販促商品は販促Bに適用されないか確認
 * * * \+ voucher_discount_detail_list= []
 */
export function TC_011953001_AokiCouponDiscountPattern() {
  group("TC_011953001 アオキクーポン（超トク）の値引パターン", () => {
    const step = {
      begin: CommonFunction.getFullDesc(ENDPOINT.SALES_BEGIN),
      barcodeAokiPrepaid: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "Aocaカードスキャン"),
      barcodeSuperBargain: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "超トク対象商品スキャン (1st)"),
      barcodeSuperBargainRescan: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "超トク対象商品スキャン (2nd)"),
      barcodeSuperBargain2: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "販促商品スキャン (1st)"),
      barcodeSuperBargain2Rescan: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "販促商品スキャン (2nd)"),
      barcodeRegularPromotion: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "非販促商品スキャン"),
      subtotal: CommonFunction.getFullDesc(ENDPOINT.SALES_SUBTOTAL),
      payment: CommonFunction.getFullDesc(ENDPOINT.SALES_ADDPAYMENT),
      end: CommonFunction.getFullDesc(ENDPOINT.SALES_END),
    };

    const faceValue = 100; // Specified in master
    const superBargainPrice = 1000; // Specified in master
    const superBargainTax = 8; // Specified in master
    const superBargain2Price = 1408; // Specified in master
    const superBargain2Tax = 10; // Specified in master
    const regularPromoPrice = 300; // Specified in master
    const regularPromoTax = 8; // Specified in master

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
        name: "Verify Aoca card scan successful",
        expected: {
          aokCd: CARD.AOKI_PREPAID.CODE,
          aokName: CARD.AOKI_PREPAID.NAME,
        },
        actual: (res) => {
          return {
            aokCd: res.result?.cartinfo?.customer?.customer_cd,
            aokName: res.result?.cartinfo?.customer?.point_card_name,
          };
        },
      }),
    ], ENVIRONMENT.RETRY_TIMES);

    TestHelper.salesCartBarcode(step.barcodeSuperBargain, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.SUPER_BARGAIN,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify 超トク対象商品 information",
        expected: {
          barcode: PROD.SUPER_BARGAIN,
          unitPrice: superBargainPrice,
          displayUnitPrice: superBargainPrice,
          taxRate: superBargainTax,
        },
        actual: (res) => ({
          barcode: res.result?.cartinfo?.items?.[0]?.barcode,
          unitPrice: res.result?.cartinfo?.items?.[0]?.unit_price,
          displayUnitPrice: res.result?.cartinfo?.items?.[0]?.display_unit_price,
          taxRate: res.result?.cartinfo?.items?.[0]?.tax_rate,
        }),
      }),
      CHECK.createEqualsCheck({
        name: "Verify 超トク対象商品 (1st) get discount according to promotion 超得クーポン（即時利用）",
        expected: {
          promotionCd: PROMOTION.SUPER_BARGAIN_COUPON_IMMEDIATE_USE.CD,
          promotionName: PROMOTION.SUPER_BARGAIN_COUPON_IMMEDIATE_USE.NAME,
          faceValue,
        },
        actual: (res) => ({
          promotionCd: res.result?.cartinfo?.items?.[0]?.voucher_discount_detail_list?.[0]?.promotion_cd,
          promotionName: res.result?.cartinfo?.items?.[0]?.voucher_discount_detail_list?.[0]?.promotion_name,
          faceValue: res.result?.cartinfo?.items?.[0]?.voucher_discount_detail_list?.[0]?.face_value,
        }),
      }),
    ]);

    TestHelper.salesCartBarcode(step.barcodeSuperBargainRescan, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.SUPER_BARGAIN,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify 超トク対象商品 (2nd) get discount according to promotion 超得クーポン（即時利用）",
        expected: {
          promotionCd: PROMOTION.SUPER_BARGAIN_COUPON_IMMEDIATE_USE.CD,
          promotionName: PROMOTION.SUPER_BARGAIN_COUPON_IMMEDIATE_USE.NAME,
          faceValue,
        },
        actual: (res) => ({
          promotionCd: res.result?.cartinfo?.items?.[1]?.voucher_discount_detail_list?.[0]?.promotion_cd,
          promotionName: res.result?.cartinfo?.items?.[1]?.voucher_discount_detail_list?.[0]?.promotion_name,
          faceValue: res.result?.cartinfo?.items?.[1]?.voucher_discount_detail_list?.[0]?.face_value,
        }),
      }),
    ]);

    TestHelper.salesCartBarcode(step.barcodeSuperBargain2, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.SUPER_BARGAIN_2,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify 販促商品 information",
        expected: {
          barcode: PROD.SUPER_BARGAIN_2,
          unitPrice: superBargain2Price,
          displayUnitPrice: superBargain2Price,
          taxRate: superBargain2Tax,
        },
        actual: (res) => ({
          barcode: res.result?.cartinfo?.items?.[2]?.barcode,
          unitPrice: res.result?.cartinfo?.items?.[2]?.unit_price,
          displayUnitPrice: res.result?.cartinfo?.items?.[2]?.display_unit_price,
          taxRate: res.result?.cartinfo?.items?.[2]?.tax_rate,
        }),
      }),
      CHECK.createEqualsCheck({
        name: "Verify 販促商品 (1st) get discount according to promotion 超得クーポン（即時利用）2",
        expected: {
          promotionCd: PROMOTION.SUPER_BARGAIN_COUPON_FIRST_ITEM_ONLY.CD,
          promotionName: PROMOTION.SUPER_BARGAIN_COUPON_FIRST_ITEM_ONLY.NAME,
          faceValue,
        },
        actual: (res) => ({
          promotionCd: res.result?.cartinfo?.items?.[2]?.voucher_discount_detail_list?.[0]?.promotion_cd,
          promotionName: res.result?.cartinfo?.items?.[2]?.voucher_discount_detail_list?.[0]?.promotion_name,
          faceValue: res.result?.cartinfo?.items?.[2]?.voucher_discount_detail_list?.[0]?.face_value,
        }),
      }),
    ]);

    TestHelper.salesCartBarcode(step.barcodeSuperBargain2Rescan, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.SUPER_BARGAIN_2,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify 販促商品 (2nd) does not get discount according to promotion 超得クーポン（即時利用）2",
        expected: true,
        actual: (res) => res.result?.cartinfo?.items?.[3]?.voucher_discount_detail_list?.length == 0,
      }),
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
      CHECK.createEqualsCheck({
        name: "Verify 非販促商品 information",
        expected: {
          barcode: PROD.REGULAR_PROMOTION,
          unitPrice: regularPromoPrice,
          displayUnitPrice: regularPromoPrice,
          taxRate: regularPromoTax,
        },
        actual: (res) => ({
          barcode: res.result?.cartinfo?.items?.[4]?.barcode,
          unitPrice: res.result?.cartinfo?.items?.[4]?.unit_price,
          displayUnitPrice: res.result?.cartinfo?.items?.[4]?.display_unit_price,
          taxRate: res.result?.cartinfo?.items?.[4]?.tax_rate,
        }),
      }),
      CHECK.createEqualsCheck({
        name: "Verify 非販促商品 does not get discount",
        expected: true,
        actual: (res) => res.result?.cartinfo?.items?.[4]?.voucher_discount_detail_list?.length == 0,
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
    }, [
      CHECK.createStatusCodeCheck(),
    ]);
  });
}
