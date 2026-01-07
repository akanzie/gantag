import * as CHECK from "../../../common/common_check.js";
import * as ENDPOINT from "../../../common/endpoint_const.js";
import * as ENVIRONMENT from "../../../common/environment_const.js";
import { group } from "k6";
import * as PROD from "../../../common/constant/product.js";
import { PAID_METHOD } from "../../../common/constant/paid_methods.js";
import { CommonFunction } from "../../../common/common_function.js";
import { TestHelper } from "../../../common/test_helper.js";
import { RECEIPT_TYPE } from "../../../common/constant/receipt_type.js";
import * as TAGS from "../../../tags/tags_const.js";

// ｎ個ちょうどパターン
/**
 * @function ｎ個ちょうどパターン
ｎ個購入ごとにX円が成立する。
 * @memberof 売上.販売促進（企画販売）
 * @description
 * {@link TAGS.POS}
 * {@link TAGS.SALES}
 * {@link TAGS.SALES_PROMOTION_PLANNED_SALES}
 * {@link TAGS.MIX_MATCH}
 * {@link TAGS.UNLIMITED_NUMBER_OF_POINTS}
 * ### テスト観点
 * * ミックスマッチ企画に設定した商品群の中から一定個数を購入することで値引する
 * * * ・ミックスマッチ企画が販促_ミックスマッチマスタに登録されていること。
 * * * ミックスマッチ成立点数＝２、繰返し発生フラグ＝True、成立価格＝500円
 * * * ・ミックスマッチの商品1～通常商品2は、販促_商品明細マスタに登録されている商品
 * * * * →　ミックスマッチの商品1でミックスマッチ成立 (合計500円のミックスマッチの商品1 、２回スキャン)
 * * * * ミックスマッチの商品2でミックスマッチ成立 (合計500円のミックスマッチの商品２、２回スキャン)
 * * * * まとめ値引対象商品Aはミックスマッチ成立しない（まとめ値引対象商品A）
 * * * ・通常商品2は、販促_商品明細マスタに登録されていない商品 (通常商品2)
 * * * * →　ミックスマッチとは関係ない商品で通常価格となる
 * * 前提：
 * * * ・m_promotion_mixed_matchesにミックスマッチの販促が設定されている。
 * * * m_promotion_mixed_matchesの下記項目で成立条件を判断する。
 * * * * →　①ミックスマッチ成立点数：mixed_matches_item_count
 * * * * →　②繰返し発生フラグ：mixed_matches_multiple_times_flgがTrue：繰返しあり
 * * * * →　③ミックスマッチ成立価格：establish_amount
 * * * ・m_promotion_detail_itemに商品が登録されている。ミックスマッチの商品1～ミックスマッチの商品2
 * * * ・m_promotion_detail_itemに商品が登録されていない。通常商品2
 * * * ・m_promotionとm_promotion_gorupにm_promotion_mixed_matchesのpromotion_cdが
 * * * 設定されている。
 * * テスト観点：
 * * * ・ミックスマッチの商品1でミックスマッチ成立
 * * * ・ミックスマッチの商品2でミックスマッチ成立
 * * * ・まとめ値引対象商品Aと通常商品2はミックスマッチ成立しない（通常価格）
 * 
 * ---
 * ### テスト方法/シナリオ
 * | Step | 手順 | エンドポイント |
 * | :-: | :--- | :--- |
 * | 1 | 取引開始 | `/sales/begin` |
 * | 2 | 合計500円のミックスマッチの商品1スキャン（1回目） | `/sales/cart/barcode` |
 * | 3 | 合計500円のミックスマッチの商品1スキャン（2回目） | `/sales/cart/barcode` |
 * | 4 | 合計500円のミックスマッチの商品1スキャン（3回目） | `/sales/cart/barcode` |
 * | 5 | 合計500円のミックスマッチの商品2 | `/sales/cart/barcode` |
 * | 6 | まとめ値引対象商品Aスキャン | `/sales/cart/barcode` |
 * | 7 | 通常商品2スキャン | `/sales/cart/barcode` |
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
 * * 1.合計500円のミックスマッチの商品1 : 4500000000163
 * * 2.合計500円のミックスマッチの商品2 : 4500000000164
 * * 3.まとめ値引対象商品A : 4500000000112
 * * 4.通常商品2: 1050000011001
 * 
 * ---
 * ### 期待結果
 * * #### 2.合計500円のミックスマッチの商品1スキャン（1回目）`/sales/cart/barcode`
 * * Verify 合計500円のミックスマッチの商品1（1回目）ミックスマッチ成立しないか確認
 * * * \+ display_unit_price : 400
 * * * \+ subtotal_discount_apportionment: 0
 * * #### 3.合計500円のミックスマッチの商品1スキャン（2回目）`/sales/cart/barcode`
 * * 合計500円のミックスマッチの商品1（1回目）, 合計500円のミックスマッチの商品1（2回目） はミックスマッチ成立するか確認
 * * * \+ subtotal_discount_name: まとめ値引き
 * * * \+ subtotal_discounts.target_items : [0, 1]
 * * * \+ subtotal_discount_amount = Total display_unit_price - まとめ値引き = (400+400)-500=300
 * * #### 4.合計500円のミックスマッチの商品1スキャン（3回目）`/sales/cart/barcode`
 * * 合計500円のミックスマッチの商品1（3回目） ミックスマッチ成立しないか確認
 * * * \+ display_unit_price : 400
 * * * \+ subtotal_discount_apportionment: 0
 * * #### 5.合計500円のミックスマッチの商品2 `/sales/cart/barcode`
 * * 合計500円のミックスマッチの商品1（3回目）,  合計500円のミックスマッチの商品2 ミックスマッチ成立するか確認
 * * * \+ subtotal_discount_name: まとめ値引き
 * * * \+ subtotal_discounts.target_items : [2, 3]
 * * * \+ subtotal_discount_amount = Total display_unit_price - まとめ値引き = (400+200)-500=100
 * * #### 6.まとめ値引対象商品Aスキャン `/sales/cart/barcode`
 * * まとめ値引対象商品A ミックスマッチ成立しないか確認
 * * * \+ display_unit_price : 300
 * * * \+ subtotal_discount_apportionment: 0
 * * #### 7.通常商品2スキャン `/sales/cart/barcode`
 * * 通常商品2 ミックスマッチ成立しないか確認
 * * * \+ display_unit_price : 1000
 * * * \+ subtotal_discount_apportionment: 0
 */
export function TC_011937001_ExactlyNItemsPattern() {
  group("TC_011937001 ｎ個ちょうどパターン", () => {
    const step = {
      begin: CommonFunction.getFullDesc(ENDPOINT.SALES_BEGIN),
      barcodeMixMatchTotal500Yen1First: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "合計500円のミックスマッチの商品1スキャン（1回目）"),
      barcodeMixMatchTotal500Yen1Second: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "合計500円のミックスマッチの商品1スキャン（2回目）"),
      barcodeMixMatchTotal500Yen1Third: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "合計500円のミックスマッチの商品1スキャン（3回目）"),
      barcodeMixMatchTotal500Yen2: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "合計500円のミックスマッチの商品2"),
      barcodeMixMatchDiscountA: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "まとめ値引対象商品Aスキャン"),
      barcodeRegular2: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "通常商品2スキャン"),
      subtotal: CommonFunction.getFullDesc(ENDPOINT.SALES_SUBTOTAL),
      payment: CommonFunction.getFullDesc(ENDPOINT.SALES_ADDPAYMENT),
      end: CommonFunction.getFullDesc(ENDPOINT.SALES_END),
    };

    // Test data
    const subtotalDiscountNotApplied = 0; // Amount not apply discount
    const mixedMatches500Amount = 500; // mix price
    const mixMatchTotal500Yen1Price = 400; // price item step barcodeMixMatchTotal500Yen1First,barcodeMixMatchTotal500Yen1Third <mix price
    const mixMatchDiscountAPrice = 300; // price item step barcodeMixMatchDiscountA <mix price
    const regular2Price = 1000; // price item step barcodeRegular2

    const bulkDiscountName = "まとめ値引き"; // master data

    const cartNo = TestHelper.salesBegin(step.begin, {
      operateEmployeeCd: ENVIRONMENT.EMPLOYEE_BARCODE,
      isSelf: false,
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    TestHelper.salesCartBarcode(step.barcodeMixMatchTotal500Yen1First, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.MIX_MATCH_TOTAL_500_YEN_1,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify 合計500円のミックスマッチの商品1（1回目） is not mix matched",
        expected: {
          displayUnitPrice: mixMatchTotal500Yen1Price,
          subtotalDiscountApportionment: subtotalDiscountNotApplied,
        },
        actual: (res) => {
          const item = res.result?.cartinfo?.items?.[0];
          return {
            displayUnitPrice: item?.display_unit_price,
            subtotalDiscountApportionment: item?.subtotal_discount_apportionment,
          };
        },
      }),
    ]);

    TestHelper.salesCartBarcode(step.barcodeMixMatchTotal500Yen1Second, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.MIX_MATCH_TOTAL_500_YEN_1,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify 合計500円のミックスマッチの商品1（1回目）, 合計500円のミックスマッチの商品1（2回目） form a mix match",
        expected: (res) => {
          const items = res.result?.cartinfo?.items;
          const totalDisplayUnitPrice = items?.reduce(
            (sum, item) => sum + (item?.display_unit_price ?? 0),
            0,
          );
          return {
            subtotalDiscountName: bulkDiscountName,
            targetItems: JSON.stringify([
              0,
              1,
            ]),
            subtotalDiscountAmount: totalDisplayUnitPrice - mixedMatches500Amount,
          };
        },
        actual: (res) => {
          const subtotalDiscount = res.result?.cartinfo?.subtotal_discounts?.[0];
          return {
            subtotalDiscountName: subtotalDiscount?.subtotal_discount_name,
            targetItems: JSON.stringify(subtotalDiscount?.target_items),
            subtotalDiscountAmount: subtotalDiscount?.subtotal_discount_amount,
          };
        },
      }),
    ]);

    TestHelper.salesCartBarcode(step.barcodeMixMatchTotal500Yen1Third, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.MIX_MATCH_TOTAL_500_YEN_1,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify 合計500円のミックスマッチの商品1（3回目） is not mix matched",
        expected: {
          displayUnitPrice: mixMatchTotal500Yen1Price,
          subtotalDiscountApportionment: subtotalDiscountNotApplied,
        },
        actual: (res) => {
          const item = res.result?.cartinfo?.items?.[2];
          return {
            displayUnitPrice: item?.display_unit_price,
            subtotalDiscountApportionment: item?.subtotal_discount_apportionment,
          };
        },
      }),
    ]);

    TestHelper.salesCartBarcode(step.barcodeMixMatchTotal500Yen2, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.MIX_MATCH_TOTAL_500_YEN_2,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify 合計500円のミックスマッチの商品1（3回目）,  合計500円のミックスマッチの商品2 form a mix match",
        expected: (res) => {
          const items = res.result?.cartinfo?.items;
          const totalDisplayUnitPrice = items?.[2]?.display_unit_price + items?.[3]?.display_unit_price;
          return {
            subtotalDiscountName: bulkDiscountName,
            targetItems: JSON.stringify([
              2,
              3,
            ]),
            subtotalDiscountAmount: totalDisplayUnitPrice - mixedMatches500Amount,
          };
        },
        actual: (res) => {
          const subtotalDiscount = res.result?.cartinfo?.subtotal_discounts?.[1];
          return {
            subtotalDiscountName: subtotalDiscount?.subtotal_discount_name,
            targetItems: JSON.stringify(subtotalDiscount?.target_items),
            subtotalDiscountAmount: subtotalDiscount?.subtotal_discount_amount,
          };
        },
      }),
    ]);

    TestHelper.salesCartBarcode(step.barcodeMixMatchDiscountA, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.MIX_MATCH_DISCOUNT_A,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify まとめ値引対象商品A is not mix matched",
        expected: {
          displayUnitPrice: mixMatchDiscountAPrice,
          subtotalDiscountApportionment: subtotalDiscountNotApplied,
        },
        actual: (res) => {
          const item = res.result?.cartinfo?.items?.[4];
          return {
            displayUnitPrice: item?.display_unit_price,
            subtotalDiscountApportionment: item?.subtotal_discount_apportionment,
          };
        },
      }),
    ]);

    TestHelper.salesCartBarcode(step.barcodeRegular2, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.REGULAR_2,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify 通常商品2 is not mix matched",
        expected: {
          displayUnitPrice: regular2Price,
          subtotalDiscountApportionment: subtotalDiscountNotApplied,
        },
        actual: (res) => {
          const item = res.result?.cartinfo?.items?.[5];
          return {
            displayUnitPrice: item?.display_unit_price,
            subtotalDiscountApportionment: item?.subtotal_discount_apportionment,
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
    ]);
  });
}

// ｎ個以上パターン
/**
 * @function ｎ個以上パターン
ｎ個購入するとX円が成立する。ｎ個より多く購入した分は通常の価格となる。
 * @memberof 売上.販売促進（企画販売）
 * @description
 * {@link TAGS.POS}
 * {@link TAGS.SALES}
 * {@link TAGS.SALES_PROMOTION_PLANNED_SALES}
 * {@link TAGS.MIX_MATCH}
 * {@link TAGS.LIMIT_ON_NUMBER_OF_POINTS_ACHIEVED}
 * ### テスト観点
 * * 企画に設定した商品群の中から一定個数を購入することで値引きする(一定個数以上は通常価格)
 * * * ・ミックスマッチ企画が販促_ミックスマッチマスタに登録されていること。
 * * * ミックスマッチ成立点数＝３、繰返し発生フラグ＝False、成立価格＝1000円
 * * * ・ミックスマッチの商品1～ミックスマッチの商品3は、販促_商品明細マスタに登録されている商品
 * * * * →　ミックスマッチの商品1でミックスマッチ成立 (合計1000円のミックスマッチの商品1x3)
 * * * * ミックスマッチの商品1、ミックスマッチの商品2、ミックスマッチの商品3はミックスマッチ成立しない
 * * * ・通常商品2は、販促_商品明細マスタに登録されていない商品
 * * * * →　ミックスマッチとは関係ない商品で通常価格となる
 * * 前提：
 * * * ・m_promotion_mixed_matchesにミックスマッチの販促が設定されている。
 * * * m_promotion_mixed_matchesの下記項目で成立条件を判断する。
 * * * * →　①ミックスマッチ成立点数：mixed_matches_item_count
 * * * * →　②繰返し発生フラグ：mixed_matches_multiple_times_flgがFalse：繰返しなし
 * * * * →　③ミックスマッチ成立価格：establish_amount
 * * * ・m_promotion_detail_itemに商品が登録されている。ミックスマッチの商品1～ミックスマッチの商品3
 * * * ・m_promotion_detail_itemに商品が登録されていない。通常商品2
 * * * ・m_promotionとm_promotion_gorupにm_promotion_mixed_matchesのpromotion_cdが
 * * * 設定されている。
 * * テスト観点：
 * * * ・ミックスマッチの商品1でミックスマッチ成立
 * * * ・ミックスマッチの商品1～3はミックスマッチ成立しない（通常価格）
 * * * ・通常商品2はミックスマッチ成立しない（通常価格）
 * 
 * ---
 * ### テスト方法/シナリオ
 * | Step | 手順 | エンドポイント |
 * | :-: | :--- | :--- |
 * | 1 | 取引開始 | `/sales/begin` |
 * | 2 | 合計1000円のミックスマッチの商品1スキャン（1回目） | `/sales/cart/barcode` |
 * | 3 | 合計1000円のミックスマッチの商品1スキャン（2回目） | `/sales/cart/barcode` |
 * | 4 | 合計1000円のミックスマッチの商品1スキャン（3回目） | `/sales/cart/barcode` |
 * | 5 | 合計1000円のミックスマッチの商品1スキャン（4回目） | `/sales/cart/barcode` |
 * | 6 | 合計1000円のミックスマッチの商品2スキャン | `/sales/cart/barcode` |
 * | 7 | 合計1000円のミックスマッチの商品3スキャン | `/sales/cart/barcode` |
 * | 8 | 通常商品2スキャン | `/sales/cart/barcode` |
 * | 9 | 小計 | `/sales/subtotal` |
 * | 10 | 支払登録 | `/sales/addpayment` |
 * | 11 | 取引完了 | `/sales/end` |
 * 
 * ---
 * ### 前提条件
 * * 特になし
 * 
 * ---
 * ### テストデータ
 * * 1.合計1000円のミックスマッチの商品1スキャン : 4500000000165
 * * 2.合計1000円のミックスマッチの商品2スキャン : 4500000000166
 * * 3.合計1000円のミックスマッチの商品3スキャン : 4500000000167
 * * 4.通常商品2: 1050000011001
 * 
 * ---
 * ### 期待結果
 * * #### 2.合計1000円のミックスマッチの商品1スキャン（1回目） `/sales/cart/barcode`
 * * 合計1000円のミックスマッチの商品1（1回目）ミックスマッチ成立しないか確認
 * * * \+ display_unit_price : 500
 * * * \+ subtotal_discount_apportionment: 0
 * * #### 3.合計1000円のミックスマッチの商品1スキャン（2回目） `/sales/cart/barcode`
 * * 合計1000円のミックスマッチの商品1（2回目） ミックスマッチ成立しないか確認
 * * * \+ display_unit_price : 500
 * * * \+ subtotal_discount_apportionment: 0
 * * #### 4.合計1000円のミックスマッチの商品1スキャン（3回目） `/sales/cart/barcode`
 * * 合計1000円のミックスマッチの商品1（1回目）, 合計1000円のミックスマッチの商品1（2回目） と 合計1000円のミックスマッチの商品1（3回目） はミックスマッチ成立するか確認
 * * * \+ subtotal_discount_name: まとめ値引き
 * * * \+ subtotal_discounts.target_items : [0, 1, 2]
 * * * \+ subtotal_discount_amount = Total display_unit_price - まとめ値引き = (500+500+500)-1000=500
 * * #### 5.合計1000円のミックスマッチの商品1スキャン（4回目） `/sales/cart/barcode`
 * * 合計1000円のミックスマッチの商品1（4回目）はミックスマッチ成立しないか確認
 * * * \+ display_unit_price : 500
 * * * \+ subtotal_discount_apportionment: 0
 * * #### 6.合計1000円のミックスマッチの商品2スキャン `/sales/cart/barcode`
 * * 合計1000円のミックスマッチの商品2 はミックスマッチ成立しないか確認
 * * * \+ display_unit_price : 400
 * * * \+ subtotal_discount_apportionment: 0
 * * #### 7.合計1000円のミックスマッチの商品3スキャン `/sales/cart/barcode`
 * * 合計1000円のミックスマッチの商品3　は　ミックスマッチ成立しないか確認
 * * * \+ display_unit_price : 300
 * * * \+ subtotal_discount_apportionment: 0
 * * #### 8.通常商品2スキャン `/sales/cart/barcode`
 * * 通常商品2 は　ミックスマッチ成立しないか確認
 * * * \+ display_unit_price : 1000
 * * * \+ subtotal_discount_apportionment: 0
 */
export function TC_011937002_MatchAtLeastNItems() {
  group("TC_011937002 ｎ個以上パターン", () => {
    const step = {
      begin: CommonFunction.getFullDesc(ENDPOINT.SALES_BEGIN),
      barcodeMixMatchTotal1000Yen1First: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "合計1000円のミックスマッチの商品1スキャン（1回目）"),
      barcodeMixMatchTotal1000Yen1Second: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "合計1000円のミックスマッチの商品1スキャン（2回目）"),
      barcodeMixMatchTotal1000Yen1Third: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "合計1000円のミックスマッチの商品1スキャン（3回目）"),
      barcodeMixMatchTotal1000Yen1Fourd: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "合計1000円のミックスマッチの商品1スキャン（4回目）"),
      barcodeMixMatchTotal1000Yen2: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "合計1000円のミックスマッチの商品2スキャン"),
      barcodeMixMatchTotal1000Yen3: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "合計1000円のミックスマッチの商品3スキャン"),
      barcodeRegular2: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "通常商品2スキャン"),
      subtotal: CommonFunction.getFullDesc(ENDPOINT.SALES_SUBTOTAL),
      payment: CommonFunction.getFullDesc(ENDPOINT.SALES_ADDPAYMENT),
      end: CommonFunction.getFullDesc(ENDPOINT.SALES_END),
    };

    const mixMatchTotal1000Yen1Price = 500; // price item step barcodeMixMatchTotal1000Yen1First,barcodeMixMatchTotal1000Yen1Second <mix price
    const subtotalDiscountNotApplied = 0; // Test data, amount not apply discount
    const mixedMatches1000Amount = 1000; // mix price
    const bulkDiscountName = "まとめ値引き"; // master data

    const cartNo = TestHelper.salesBegin(step.begin, {
      operateEmployeeCd: ENVIRONMENT.EMPLOYEE_BARCODE,
      isSelf: false,
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    TestHelper.salesCartBarcode(step.barcodeMixMatchTotal1000Yen1First, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.MIX_MATCH_TOTAL_1000_YEN_1,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify 合計1000円のミックスマッチの商品1（1回目） is not mix matched",
        expected: {
          displayUnitPrice: mixMatchTotal1000Yen1Price,
          subtotalDiscountApportionment: subtotalDiscountNotApplied,
        },
        actual: (res) => {
          const item = res.result?.cartinfo?.items?.[0];
          return {
            displayUnitPrice: item?.display_unit_price,
            subtotalDiscountApportionment: item?.subtotal_discount_apportionment,
          };
        },
      }),
    ]);

    TestHelper.salesCartBarcode(step.barcodeMixMatchTotal1000Yen1Second, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.MIX_MATCH_TOTAL_1000_YEN_1,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify 合計1000円のミックスマッチの商品1（2回目） is not mix matched",
        expected: {
          displayUnitPrice: mixMatchTotal1000Yen1Price,
          subtotalDiscountApportionment: subtotalDiscountNotApplied,
        },
        actual: (res) => {
          const item = res.result?.cartinfo?.items?.[1];
          return {
            displayUnitPrice: item?.display_unit_price,
            subtotalDiscountApportionment: item?.subtotal_discount_apportionment,
          };
        },
      }),
    ]);

    TestHelper.salesCartBarcode(step.barcodeMixMatchTotal1000Yen1Third, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.MIX_MATCH_TOTAL_1000_YEN_1,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify 合計1000円のミックスマッチの商品1（1回目）, 合計1000円のミックスマッチの商品1（2回目） and 合計1000円のミックスマッチの商品1（3回目） form a mix match",
        expected: (res) => {
          const items = res.result?.cartinfo?.items;
          const totalDisplayUnitPrice = items?.reduce(
            (sum, item) => sum + (item?.display_unit_price ?? 0),
            0,
          );
          return {
            subtotalDiscountName: bulkDiscountName,
            targetItems: JSON.stringify([
              0,
              1,
              2,
            ]),
            subtotalDiscountAmount: totalDisplayUnitPrice - mixedMatches1000Amount,
          };
        },
        actual: (res) => {
          const subtotalDiscount = res.result?.cartinfo?.subtotal_discounts?.[0];
          return {
            subtotalDiscountName: subtotalDiscount?.subtotal_discount_name,
            targetItems: JSON.stringify(subtotalDiscount?.target_items),
            subtotalDiscountAmount: subtotalDiscount?.subtotal_discount_amount,
          };
        },
      }),
    ]);

    TestHelper.salesCartBarcode(step.barcodeMixMatchTotal1000Yen1Fourd, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.MIX_MATCH_TOTAL_1000_YEN_1,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify 合計1000円のミックスマッチの商品1（4回目） is not mix matched",
        expected: {
          displayUnitPrice: 500,
          subtotalDiscountApportionment: subtotalDiscountNotApplied,
        },
        actual: (res) => {
          const item = res.result?.cartinfo?.items?.[3];
          return {
            displayUnitPrice: item?.display_unit_price,
            subtotalDiscountApportionment: item?.subtotal_discount_apportionment,
          };
        },
      }),
    ]);

    TestHelper.salesCartBarcode(step.barcodeMixMatchTotal1000Yen2, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.MIX_MATCH_TOTAL_1000_YEN_2,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify 合計1000円のミックスマッチの商品2 is not mix matched",
        expected: {
          displayUnitPrice: 400,
          subtotalDiscountApportionment: subtotalDiscountNotApplied,
        },
        actual: (res) => {
          const item = res.result?.cartinfo?.items?.[4];
          return {
            displayUnitPrice: item?.display_unit_price,
            subtotalDiscountApportionment: item?.subtotal_discount_apportionment,
          };
        },
      }),
    ]);

    TestHelper.salesCartBarcode(step.barcodeMixMatchTotal1000Yen3, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.MIX_MATCH_TOTAL_1000_YEN_3,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify 合計1000円のミックスマッチの商品3 is not mix matched",
        expected: {
          displayUnitPrice: 300,
          subtotalDiscountApportionment: subtotalDiscountNotApplied,
        },
        actual: (res) => {
          const item = res.result?.cartinfo?.items?.[5];
          return {
            displayUnitPrice: item?.display_unit_price,
            subtotalDiscountApportionment: item?.subtotal_discount_apportionment,
          };
        },
      }),
    ]);

    TestHelper.salesCartBarcode(step.barcodeRegular2, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.REGULAR_2,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify 通常商品2 is not mix matched",
        expected: {
          displayUnitPrice: 1000,
          subtotalDiscountApportionment: subtotalDiscountNotApplied,
        },
        actual: (res) => {
          const item = res.result?.cartinfo?.items?.[6];
          return {
            displayUnitPrice: item?.display_unit_price,
            subtotalDiscountApportionment: item?.subtotal_discount_apportionment,
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
    ]);
  });
}
