import * as CHECK from "../../../common/common_check.js";
import * as ENDPOINT from "../../../common/endpoint_const.js";
import * as PROD from "../../../common/constant/product.js";
import * as ENVIRONMENT from "../../../common/environment_const.js";
import { PAID_METHOD } from "../../../common/constant/paid_methods.js";
import { group } from "k6";
import { COUPON } from "../../../common/constant/coupon.js";
import { CommonFunction } from "../../../common/common_function.js";
import { TestHelper } from "../../../common/test_helper.js";
import { Formular } from "../../../common/formular.js";
import * as TAGS from "../../../tags/tags_const.js";

/**
 * @function セルフPOSの株主優待（正常系）
 * @memberof 売上.販売促進（企画販売）
 * @description
 * {@link TAGS.POS}
 * {@link TAGS.SALES}
 * {@link TAGS.SALES_PROMOTION_PLANNED_SALES}
 * {@link TAGS.SHAREHOLDER_BENEFITS}
 * ### テスト観点
 * * 前提：
 * * * ・株主優待バーコードがm_couponに設定されている。
 * * * ・株主優待割許可商品(対象)：m_store_item.allow_shareholder_benefit_type= 1（対象）
 * * * ・株主優待割許可商品(対象外)：m_store_item.allow_shareholder_benefit_type= 2（非対象）
 * * * ・株主優待割許可商品(上位参照)：m_store_item.allow_shareholder_benefit_type= 9（上位参照）
 * * * * 　  かつ、m_item_category.allow_shareholder_benefit_type= 1（対象）
 * * テスト観点：
 * * 商品登録画面で株主優待バーコードをスキャンし株主優待が反映される。
 * * * ・小計に社割の金額が表示される。
 * * * ・株主優待割許可商品(対象)と株主優待割許可商品(上位参照)が割引される。
 * * * ・株主優待割許可商品(対象外)は割引されない。
 * 
 * ---
 * ### テスト方法/シナリオ
 * | Step | 手順 | エンドポイント |
 * | :-: | :--- | :--- |
 * | 1 | 取引開始 | `/sales/begin` |
 * | 2 | 株主優待割許可商品(対象)スキャン | `/sales/cart/barcode` |
 * | 3 | 株主優待割許可商品(対象外)スキャン | `/sales/cart/barcode` |
 * | 4 | 株主優待バーコードスキャン | - |
 * | 5 | 株主優待割許可商品(上位参照)スキャン | `/sales/cart/barcode` |
 * | 6 | 小計 | `/sales/subtotal` |
 * 
 * ---
 * ### 前提条件
 * * 特になし
 * 
 * ---
 * ### テストデータ
 * * 1.株主優待割許可商品(対象): 4931290077013
 * * 2.株主優待割許可商品(対象外): 2016020000010
 * * 3.株主優待割許可商品(上位参照): 0019014614035
 * * 4.株主優待 : K20180900
 * 
 * ---
 * ### 期待結果
 * * #### 2. 株主優待割許可商品(対象) `/sales/cart/barcode`
 * * \- カートの情報に株主優待割許可商品(対象)があることを確認
 * * * \+ barcode: 4931290077013
 * * #### 3. 株主優待割許可商品(対象外) `/sales/cart/barcode`
 * * \- カートの情報に株主優待割許可商品(対象外)があることを確認
 * * * \+ barcode: 2016020000010
 * * 4.株主優待バーコードスキャン
 * * \- カートの情報に株主優待があることを確認
 * * * \+ subtotal_discount_cd: 2004
 * * * \+ subtotal_discount_name: 株主優待
 * * #### 5. 株主優待割許可商品(上位参照) `/sales/cart/barcode`
 * * \- カートの情報に株主優待割許可商品(上位参照)があることを確認
 * * * \+ barcode: 0019014614035
 * * #### 6. 小計 `/sales/subtotal`
 * * \- 株主優待割引が株主優待割許可商品(対象)および株主優待割許可商品(上位参照)にのみ適用され、株主優待割許可商品(対象外)には適用されないことを確認 (subtotal_discounts.target_items に 0.2 が含まれる)
 * * \- 株主優待割引額が208であることを確認 (株主優待割許可商品(対象)および株主優待割許可商品(上位参照)が割引され、株主優待割許可商品(対象外)は割引されない)
 * * * \+ 株主優待割引総額 = 株主優待割引対象商品の総価格 × (Voucher Master.Voucher Discount Rate ÷ 100)
 * * * \+ 株主優待割引総額 = (株主優待割許可商品(対象) + 株主優待割許可商品(上位参照)) × 5 ÷ 100 = (198 + 3980) × 5 ÷ 100 = 4178 × 5 ÷ 100 = 208.9
 * * * \+ Voucher Master.SubtotalDiscountRoundingMethodType が切り下げ(2)、Voucher Master.SubtotalDiscountRoundingDigitType が小数点以下1桁(1)なので、株主優待割引額は208
 * * #### 8. 取引完了 `/sales/end`
 * * \- レシートが正しく印刷され、3つのアイテム「株主優待割許可商品(対象)、株主優待割許可商品(対象外)、株主優待割許可商品(上位参照)」の情報が含まれていることを確認
 * * \- 「株主優待」の適用を確認 (xml に株主優待が含まれる)
 */
export function TC_011946001_ShareholderBenefit() {
  group("TC_011946001 セルフPOSの株主優待（正常系）", () => {
    const step = {
      begin: CommonFunction.getFullDesc(ENDPOINT.SALES_BEGIN),
      barcodeShareholderDiscountAllowed: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "株主優待割許可商品(対象)スキャン"),
      barcodeShareholderDiscountExclude: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "株主優待割許可商品(対象外)スキャン"),
      barcodeShareholderBenefits: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "株主優待バーコードスキャン"),
      barcodeShareholderDiscountReferUpper: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "株主優待割許可商品(上位参照)スキャン"),
      subtotal: CommonFunction.getFullDesc(ENDPOINT.SALES_SUBTOTAL),
      payment: CommonFunction.getFullDesc(ENDPOINT.SALES_ADDPAYMENT),
      end: CommonFunction.getFullDesc(ENDPOINT.SALES_END),
    };

    // 1.取引開始 /sales/begin
    const cartNo = TestHelper.salesBegin(step.begin, {}, [
      CHECK.createStatusCodeCheck(),
    ]);

    // 2.株主優待割許可商品(対象)スキャン /sales/cart/barcode
    TestHelper.salesCartBarcode(step.barcodeShareholderDiscountAllowed, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.SHAREHOLDER_DISCOUNT_ALLOWED,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify the cart info has 株主優待割許可商品(対象): barcode",
        expected: PROD.SHAREHOLDER_DISCOUNT_ALLOWED,
        actual: (res) => res.result?.cartinfo?.items?.[0]?.barcode,
      }),
    ]);

    // 3.株主優待割許可商品(対象外)スキャン /sales/cart/barcode
    TestHelper.salesCartBarcode(step.barcodeShareholderDiscountExclude, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.SHAREHOLDER_DISCOUNT_EXCLUDE,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify the cart info has 株主優待割許可商品(対象外): barcode",
        expected: PROD.SHAREHOLDER_DISCOUNT_EXCLUDE,
        actual: (res) => res.result?.cartinfo?.items?.[1]?.barcode,
      }),
    ]);

    // 4.株主優待バーコードスキャン /sales/cart/barcode
    TestHelper.salesCartBarcode(step.barcodeShareholderBenefits, {
      cartNo,
      barcodes: [
        {
          barcode: COUPON.SHAREHOLDER_BENEFITS.CD,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify the cart info has 株主優待",
        expected: {
          subtotalDiscountCd: COUPON.SHAREHOLDER_BENEFITS.DISCOUNT_CD,
          subtotalDiscountName: COUPON.SHAREHOLDER_BENEFITS.DISCOUNT_NAME,
          subtotalDiscountRate: COUPON.SHAREHOLDER_BENEFITS.DISCOUNT_RATE,
        },
        actual: (res) => {
          const subTotalDiscounts = res.result?.cartinfo?.subtotal_discounts?.[0];
          return {
            subtotalDiscountCd: subTotalDiscounts?.subtotal_discount_cd,
            subtotalDiscountName: subTotalDiscounts?.subtotal_discount_name,
            subtotalDiscountRate: subTotalDiscounts?.subtotal_discount_rate,
          };
        },
      }),
    ]);

    // 5.株主優待割許可商品(上位参照)スキャン /sales/cart/barcode
    const cartItems = TestHelper.salesCartBarcode(step.barcodeShareholderDiscountReferUpper, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.SHAREHOLDER_DISCOUNT_REFER_UPPER,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify the cart info has 株主優待割許可商品(上位参照): barcode",
        expected: PROD.SHAREHOLDER_DISCOUNT_REFER_UPPER,
        actual: (res) => res.result?.cartinfo?.items?.[2]?.barcode,
      }),
    ]).result?.cartinfo?.items;

    const shareholderDiscountAllowedIdx = cartItems?.findIndex(q => q.barcode === PROD.SHAREHOLDER_DISCOUNT_ALLOWED);
    const shareholderDiscountExcludeIdx = cartItems?.findIndex(q => q.barcode === PROD.SHAREHOLDER_DISCOUNT_EXCLUDE);
    const shareholderDiscountReferUpperIdx = cartItems?.findIndex(q => q.barcode === PROD.SHAREHOLDER_DISCOUNT_REFER_UPPER);

    // 6.小計 /sales/subtotal
    const totalBalanceAmount = TestHelper.salesSubtotal(step.subtotal, cartNo, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify shareholder benefit discount only applies to 株主優待割許可商品(対象) and 株主優待割許可商品(上位参照), not to 株主優待割許可商品(対象外)",
        expected: {
          targetItems: JSON.stringify([
            shareholderDiscountAllowedIdx,
            shareholderDiscountReferUpperIdx,
          ]),
          nonTargetItems: JSON.stringify([
            shareholderDiscountExcludeIdx,
          ]),
        },
        actual: (res) => {
          const cartinfo = res.result?.cartinfo;
          const subtotalDiscount = cartinfo?.subtotal_discounts?.[0];
          return {
            targetItems: JSON.stringify(subtotalDiscount?.target_items),
            nonTargetItems: JSON.stringify(subtotalDiscount?.non_target_items),
          };
        },
      }),
      CHECK.createEqualsCheck({
        name: "Verify the shareholder benefit discount amount",
        expected: (res) => {
          const items = res.result?.cartinfo?.items;
          const totalAmountOfTargetItems = (items?.[shareholderDiscountAllowedIdx]?.display_unit_price ?? 0) + (items?.[shareholderDiscountReferUpperIdx]?.display_unit_price ?? 0);
          return Math.trunc(totalAmountOfTargetItems * COUPON.SHAREHOLDER_BENEFITS.DISCOUNT_RATE / 100);
        },
        actual: (res) => res.result?.cartinfo?.subtotal_discounts?.[0]?.subtotal_discount_amount,
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

    //8.取引完了 /sales/end
    TestHelper.salesEnd(step.end, {
      cartNo,
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify receipt data must contain 3 scanned items",
        expected: true,
        actual: (res) => CommonFunction.includesItems([
          PROD.SHAREHOLDER_DISCOUNT_ALLOWED,
          PROD.SHAREHOLDER_DISCOUNT_EXCLUDE,
          PROD.SHAREHOLDER_DISCOUNT_REFER_UPPER,
        ], res.result?.receipts?.[0]?.receipt_data),
      }),
      CHECK.createEqualsCheck({
        name: "Verify apply 株主優待",
        expected: true,
        actual: (res) => CommonFunction.includesItems([
          "株主優待",
        ], res.result?.receipts?.[0]?.receipt_data),
      }),
    ]);
  });
}

/**
 * @function セルフPOSの株主優待（異常系：有効期限ではない）
 * @memberof 売上.販売促進（企画販売）
 * @description
 * {@link TAGS.POS}
 * {@link TAGS.SALES}
 * {@link TAGS.SALES_PROMOTION_PLANNED_SALES}
 * {@link TAGS.SHAREHOLDER_BENEFITS}
 * {@link TAGS.EXPIRY_DATE_CHECK}
 * ### テスト観点
 * * 商品登録画面で株主優待バーコードをスキャンし有効期限エラーとなる。
 * * * → 株主優待バーコードはクーポンマスタに株主優待レコードが存在し、
 * * * 有効期限が範囲外のもの。
 * * * → 株主優待割許可商品(対象)：商品マスタの株主優待許可区分が１（対象）
 * * *    株主優待割許可商品(対象外)：商品マスタの株主優待許可区分が２（非対象）
 * * 前提：
 * * * ・株主優待バーコードがm_couponに設定されている。
 * * * かつ、m_coupon.start_datetimeとm_coupon.end_datetimeが有効期限外。
 * * * ・株主優待割許可商品(対象)：m_store_item.allow_shareholder_benefit_type= 1（対象）
 * * * ・株主優待割許可商品(対象外)：m_store_item.allow_shareholder_benefit_type= 2（非対象）
 * * テスト観点：
 * * 株主優待バーコードが利用期間外の場合にエラーになる。
 * * * ・エラー内容：
 * * * エラーメッセージ: このクーポンは現在利用できません（利用期間終了）
 * * * エラーコード: CPN0003
 * 
 * ---
 * ### テスト方法/シナリオ
 * | Step | 手順 | エンドポイント |
 * | :-: | :--- | :--- |
 * | 1 | 取引開始 | `/sales/begin` |
 * | 2 | 株主優待割許可商品(対象)スキャン | `/sales/cart/barcode` |
 * | 3 | 株主優待割許可商品(対象外)スキャン | `/sales/cart/barcode` |
 * | 4 | 株主優待バーコードスキャン　→　エラー終了 | - |
 * 
 * ---
 * ### 前提条件
 * * 特になし
 * 
 * ---
 * ### テストデータ
 * * 1.株主優待割許可商品(対象): 4931290077013
 * * 2.株主優待割許可商品(対象外): 2016020000010
 * * 3.株主優待券（利用期間外）: K20181000
 * 
 * ---
 * ### 期待結果
 * * 2.株主優待割許可商品(対象)スキャン `/sales/cart/barcode`
 * * カートInfoにて 株主優待割許可商品(対象)があるか確認
 * * * \+ バーコード : 4931290077013
 * * 3.株主優待割許可商品(対象外)スキャン `/sales/cart/barcode`
 * * カートInfoにて 株主優待割許可商品(対象外)があるか確認
 * * * \+ バーコード : 2016020000010
 * * 4.株主優待バーコードスキャン　→　エラー終了
 * * \- ステータスコード: 220
 * * \- エラーメッセージ: "このクーポンは現在利用できません（利用期間終了）",
 * * \- エラーコード: "CPN0003",
 */
export function TC_011946002_ShareholderBenefitOutOfDate() {
  group("TC_011946002 セルフPOSの株主優待（異常系：有効期限ではない）", () => {
    const step = {
      begin: CommonFunction.getFullDesc(ENDPOINT.SALES_BEGIN),
      barcodeShareholderDiscountAllowed: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "株主優待割許可商品(対象)スキャン"),
      barcodeShareholderDiscountExclude: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "株主優待割許可商品(対象外)スキャン"),
      barcodeShareHolderBenefitsOutOfDate: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "株主優待券（利用期間外スキャン"),
    };

    const cartNo = TestHelper.salesBegin(step.begin, {}, [
      CHECK.createStatusCodeCheck(),
    ]);

    TestHelper.salesCartBarcode(step.barcodeShareholderDiscountAllowed, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.SHAREHOLDER_DISCOUNT_ALLOWED,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify the cart info has 株主優待割許可商品(対象): barcode",
        expected: true,
        actual: (res) => CommonFunction.hasItems([
          PROD.SHAREHOLDER_DISCOUNT_ALLOWED,
        ], res.result?.cartinfo?.items),
      }),
    ]);

    TestHelper.salesCartBarcode(step.barcodeShareholderDiscountExclude, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.SHAREHOLDER_DISCOUNT_EXCLUDE,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify the cart info has 株主優待割許可商品(対象外): barcode",
        expected: true,
        actual: (res) => CommonFunction.hasItems([
          PROD.SHAREHOLDER_DISCOUNT_EXCLUDE,
        ], res.result?.cartinfo?.items),
      }),
    ]);

    TestHelper.salesCartBarcode(step.barcodeShareHolderBenefitsOutOfDate, {
      cartNo,
      barcodes: [
        {
          barcode: COUPON.SHAREHOLDER_BENEFITS_OUT_OF_DATE.CD,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(220),
      CHECK.createErrorCheck("CPN0003", "このクーポンは現在利用できません（利用期間終了）"),
    ]);
  });
}

/**
 * @function セルフPOSの株主優待（異常系：利用可能回数超過）
 * @memberof 売上.販売促進（企画販売）
 * @description
 * {@link TAGS.POS}
 * {@link TAGS.SALES}
 * {@link TAGS.SALES_PROMOTION_PLANNED_SALES}
 * {@link TAGS.SHAREHOLDER_BENEFITS}
 * ### テスト観点
 * * 商品登録画面で株主優待バーコードをスキャンし利用可能回数超過エラーとなる。
 * * * → 株主優待バーコードはクーポンマスタに株主優待レコードが存在し、
 * * * 利用可能枚数が1のもの(１回目のスキャンは正常、２回目のスキャンはエラー)
 * * * → 株主優待割許可商品(対象)：商品マスタの株主優待許可区分が１（対象）
 * * * 株主優待割許可商品(対象外)：商品マスタの株主優待許可区分が２（非対象）
 * * 前提：
 * * * ・株主優待バーコードがm_couponに設定されている。
 * * * かつ、m_coupon.usage_limit_person ＜ 利用回数。
 * * * ・株主優待割許可商品(対象)：m_store_item.allow_shareholder_benefit_type= 1（対象）
 * * * ・株主優待割許可商品(対象外)：m_store_item.allow_shareholder_benefit_type= 2（非対象）
 * * テスト観点：
 * * 株主優待バーコードが利用可能回数超過の場合にエラーになる。　
 * * エラー内容：
 * * \- エラーメッセージ: "クーポンが適用できる上限回数を超えています",
 * * \- エラーコード: "DCT0007"
 * 
 * ---
 * ### テスト方法/シナリオ
 * | Step | 手順 | エンドポイント |
 * | :-: | :--- | :--- |
 * | 1 | 取引開始 | `/sales/begin` |
 * | 2 | 株主優待割許可商品(対象)スキャン | `/sales/cart/barcode` |
 * | 3 | 株主優待割許可商品(対象外)スキャン | `/sales/cart/barcode` |
 * | 4 | 株主優待バーコードスキャン (１回目) | - |
 * | 5 | 株主優待バーコードスキャン（２回目） 　→　エラー終了 | - |
 * 
 * ---
 * ### 前提条件
 * * 特になし
 * 
 * ---
 * ### テストデータ
 * * 1.株主優待割許可商品(対象): 4931290077013
 * * 2.株主優待割許可商品(対象外): 2016020000010
 * * 3.株主優待券 (使用者限定は1): K20251000
 * 
 * ---
 * ### 期待結果
 * * 4.株主優待バーコードスキャン (１回目)
 * * \- Cart Info に 株主優待 (使用者限定は1)があるか確認
 * * * \+ subtotal_discount_cd: 2004
 * * * \+ subtotal_discount_name: 株主優待
 * * 5.株主優待バーコードスキャン (２回目)　→　エラー終了  (2nd)
 * * \- ステータスコード: 220
 * * \- エラーメッセージ: "クーポンが適用できる上限回数を超えています",
 * * \- エラーコード: "DCT0007",
 */
export function TC_011946003_ShareholderBenefitUsageLimitPerson1() {
  group("TC_011946003 セルフPOSの株主優待（異常系：利用可能回数超過）", () => {
    const step = {
      begin: CommonFunction.getFullDesc(ENDPOINT.SALES_BEGIN),
      barcodeShareholderDiscountAllowed: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "株主優待割許可商品(対象)スキャン"),
      barcodeShareholderDiscountExclude: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "株主優待割許可商品(対象外)スキャン"),
      barcodeShareHolderBenefitsUsageLimitPerson1: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "株主優待券 (使用者限定は1) 1スキャン"),
      barcodeShareHolderBenefitsUsageLimitPerson1Second: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "株主優待券 (使用者限定は1) 2スキャン"),
    };

    const cartNo = TestHelper.salesBegin(step.begin, {}, [
      CHECK.createStatusCodeCheck(),
    ]);

    TestHelper.salesCartBarcode(step.barcodeShareholderDiscountAllowed, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.SHAREHOLDER_DISCOUNT_ALLOWED,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    TestHelper.salesCartBarcode(step.barcodeShareholderDiscountExclude, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.SHAREHOLDER_DISCOUNT_EXCLUDE,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    TestHelper.salesCartBarcode(step.barcodeShareHolderBenefitsUsageLimitPerson1, {
      cartNo,
      barcodes: [
        {
          barcode: COUPON.SHAREHOLDER_BENEFITS_USAGE_LIMIT_PERSON_1.CD,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(200),
      CHECK.createEqualsCheck({
        name: "Verify the cart info has 株主優待 (使用者限定は1) 1スキャン",
        expected: {
          subtotalDiscountCd: COUPON.SHAREHOLDER_BENEFITS_USAGE_LIMIT_PERSON_1.DISCOUNT_CD,
          subtotalDiscountName: COUPON.SHAREHOLDER_BENEFITS_USAGE_LIMIT_PERSON_1.DISCOUNT_NAME,
        },
        actual: (res) => {
          const subTotalDiscounts = res.result?.cartinfo?.subtotal_discounts[0];
          return {
            subtotalDiscountCd: subTotalDiscounts?.subtotal_discount_cd,
            subtotalDiscountName: subTotalDiscounts?.subtotal_discount_name,
          };
        },
      }),
    ]);

    TestHelper.salesCartBarcode(step.barcodeShareHolderBenefitsUsageLimitPerson1Second, {
      cartNo,
      barcodes: [
        {
          barcode: COUPON.SHAREHOLDER_BENEFITS_USAGE_LIMIT_PERSON_1.CD,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(220),
      CHECK.createErrorCheck("DCT0007", "クーポンが適用できる上限回数を超えています"),
    ]);
  });
}

/**
 * @function 有人POSの株主優待（正常系）
 * @memberof 売上.販売促進（企画販売）
 * @description
 * {@link TAGS.POS}
 * {@link TAGS.SALES}
 * {@link TAGS.SALES_PROMOTION_PLANNED_SALES}
 * {@link TAGS.SHAREHOLDER_BENEFITS}
 * ### テスト観点
 * * 前提：
 * * * ・株主優待バーコードがm_couponに設定されている。
 * * * ・株主優待割許可商品：m_store_item.allow_shareholder_benefit_type= 1（対象）
 * * * ・株主優待割許可商品(対象外)：m_store_item.allow_shareholder_benefit_type= 2（非対象）
 * * * ・株主優待割許可商品(上位参照)：m_store_item.allow_shareholder_benefit_type= 9（上位参照）
 * * * * 　  かつ、m_item_category.allow_shareholder_benefit_type= 1（対象）
 * * テスト観点：
 * * 商品登録画面で株主優待バーコードをスキャンし株主優待が反映される。
 * * * ・小計に社割の金額が表示される。
 * * * ・株主優待割許可商品(対象)と株主優待割許可商品(上位参照)が割引される。
 * * * ・株主優待割許可商品(対象外)は割引されない。
 * 
 * ---
 * ### テスト方法/シナリオ
 * | Step | 手順 | エンドポイント |
 * | :-: | :--- | :--- |
 * | 1 | 取引開始 | `/sales/begin` |
 * | 2 | 株主優待割許可商品(対象)スキャン | `/sales/cart/barcode` |
 * | 3 | 株主優待割許可商品(対象外)スキャン | `/sales/cart/barcode` |
 * | 4 | 株主優待バーコードスキャン | - |
 * | 5 | 株主優待割許可商品(上位参照)スキャン | `/sales/cart/barcode` |
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
 * * 1.株主優待割許可商品(対象): 4931290077013
 * * 2.株主優待割許可商品(対象外): 2016020000010
 * * 3.株主優待割許可商品(上位参照): 0019014614035
 * * 4.株主優待 : K20180900
 * 
 * ---
 * ### 期待結果
 * * #### 2.株主優待割許可商品(対象)スキャン `/sales/cart/barcode`
 * * \- カートInfoに株主優待割許可商品(対象)があるか確認
 * * * \+ バーコード: 4931290077013
 * * #### 3.株3.株主優待割許可商品(対象外)スキャン `/sales/cart/barcode`
 * * \- カートInfoに 株主優待割許可商品(対象外)があるか確認
 * * * \+ barcode: 2016020000010
 * * 4.株主優待バーコードスキャン
 * * \- 株主優待が適用されたか確認
 * * * \+ subtotal_discount_cd: 2004
 * * * \+ subtotal_discount_name: 株主優待
 * * * \+ subtotal_discount_rate: 5
 * * #### 5.株主優待割許可商品(上位参照)スキャン `/sales/cart/barcode`
 * * \- カートInfoに 株主優待割許可商品(上位参照)があるか確認
 * * * \+ バーコード: 0019014614035
 * * #### 6.小計 `/sales/subtotal`
 * * \- 株主待遇は株主優待割許可商品(対象), 株主優待割許可商品(上位参照)に適用され、株主優待割許可商品(対象外) に適用されないか　確認
 * * * \+ subtotal_discounts.target_itemsに 0,2がある
 * * * \+ subtotal_discounts.non_target_items に 1がある
 * * \- 株主待遇額が 208 か確認
 * * * \+ 株主待遇額 = 株主待遇対処となる商品の合計 × (Voucher Master.Voucher Discount Rate ÷ 100)
 * * * \+ 株主待遇額 = (株主優待割許可商品(対象) + 株主優待割許可商品(上位参照)) x 5 ÷ 100 = (198 + 3980) x 5 ÷ 100 = 4178 x 5 ÷ 100 = 208.9
 * * * \+ Voucher Master.SubtotalDiscountRoundingMethodTypeは切り捨て(2), Master.SubtotalDiscountRoundingDigitType FirstDecimalPlace(1)、なので株主待遇額は208
 */
export function TC_011946004_ShareholderBenefitHasEmployee() {
  group("TC_011946004 有人POSの株主優待（正常系）", () => {
    const step = {
      begin: CommonFunction.getFullDesc(ENDPOINT.SALES_BEGIN),
      barcodeShareholderDiscountAllowed: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "株主優待割許可商品(対象)スキャン"),
      barcodeShareholderDiscountExclude: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "株主優待割許可商品(対象外)スキャン"),
      barcodeShareholderBenefits: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "株主優待バーコードスキャン"),
      barcodeShareholderDiscountReferUpper: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "株主優待割許可商品(上位参照)スキャン"),
      subtotal: CommonFunction.getFullDesc(ENDPOINT.SALES_SUBTOTAL),
      payment: CommonFunction.getFullDesc(ENDPOINT.SALES_ADDPAYMENT),
      end: CommonFunction.getFullDesc(ENDPOINT.SALES_END),
    };

    // Test data
    const operateEmployeeCd = ENVIRONMENT.EMPLOYEE_BARCODE;
    const terminalId = "6408903999802";

    const shareholderRoundingMethod = 2; // Specified in master, RoundingMethod Type is rounding down

    const cartNo = TestHelper.salesBegin(step.begin, {
      operateEmployeeCd,
      isSelf: false,
      terminalId,
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    TestHelper.salesCartBarcode(step.barcodeShareholderDiscountAllowed, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.SHAREHOLDER_DISCOUNT_ALLOWED,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify the cart info has 株主優待割許可商品(対象): barcode",
        expected: true,
        actual: (res) => CommonFunction.hasItems([
          PROD.SHAREHOLDER_DISCOUNT_ALLOWED,
        ], res.result?.cartinfo?.items),
      }),
    ]);

    TestHelper.salesCartBarcode(step.barcodeShareholderDiscountExclude, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.SHAREHOLDER_DISCOUNT_EXCLUDE,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify the cart info has 株主優待割許可商品(対象外): barcode",
        expected: true,
        actual: (res) => CommonFunction.hasItems([
          PROD.SHAREHOLDER_DISCOUNT_EXCLUDE,
        ], res.result?.cartinfo?.items),
      }),
    ]);

    TestHelper.salesCartBarcode(step.barcodeShareholderBenefits, {
      cartNo,
      barcodes: [
        {
          barcode: COUPON.SHAREHOLDER_BENEFITS.CD,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify the cart info has 株主優待",
        expected: {
          subtotalDiscountCd: COUPON.SHAREHOLDER_BENEFITS.DISCOUNT_CD,
          subtotalDiscountName: COUPON.SHAREHOLDER_BENEFITS.DISCOUNT_NAME,
          subtotalDiscountRate: COUPON.SHAREHOLDER_BENEFITS.DISCOUNT_RATE,
        },
        actual: (res) => {
          const subTotalDiscounts = res.result?.cartinfo?.subtotal_discounts[0];
          return {
            subtotalDiscountCd: subTotalDiscounts?.subtotal_discount_cd,
            subtotalDiscountName: subTotalDiscounts?.subtotal_discount_name,
            subtotalDiscountRate: subTotalDiscounts?.subtotal_discount_rate,
          };
        },
      }),
    ]);

    const cartItems = TestHelper.salesCartBarcode(step.barcodeShareholderDiscountReferUpper, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.SHAREHOLDER_DISCOUNT_REFER_UPPER,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify the cart info has 株主優待割許可商品(上位参照): barcode",
        expected: true,
        actual: (res) => CommonFunction.hasItems([
          PROD.SHAREHOLDER_DISCOUNT_REFER_UPPER,
        ], res.result?.cartinfo?.items),
      }),
    ]).result?.cartinfo?.items;

    const shareholderDiscountAllowedIdx = cartItems?.findIndex(q => q.barcode === PROD.SHAREHOLDER_DISCOUNT_ALLOWED);
    const shareholderDiscountExcludeIdx = cartItems?.findIndex(q => q.barcode === PROD.SHAREHOLDER_DISCOUNT_EXCLUDE);
    const shareholderDiscountReferUpperIdx = cartItems?.findIndex(q => q.barcode === PROD.SHAREHOLDER_DISCOUNT_REFER_UPPER);

    TestHelper.salesSubtotal(step.subtotal, cartNo, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify shareholder benefit discount verification only applies to 株主優待割許可商品(対象) and 株主優待割許可商品(上位参照), not to 株主優待割許可商品(対象外)",
        expected: true,
        actual: (res) => {
          const subTotalDiscounts = res.result?.cartinfo?.subtotal_discounts?.[0];
          return subTotalDiscounts?.target_items?.includes(shareholderDiscountAllowedIdx) && subTotalDiscounts?.target_items?.includes(shareholderDiscountReferUpperIdx) &&
            subTotalDiscounts?.non_target_items?.includes(shareholderDiscountExcludeIdx);
        },
      }),
      CHECK.createEqualsCheck({
        name: "Verify the shareholder benefit discount amount",
        expected: (res) => {
          const items = res.result?.cartinfo?.items;
          const targetItems = [
            items?.[shareholderDiscountAllowedIdx],
            items?.[shareholderDiscountReferUpperIdx],
          ];
          return Formular.calcShareHolderBenefitDiscountAmount({
            items: targetItems,
            discountRate: COUPON.SHAREHOLDER_BENEFITS.DISCOUNT_RATE,
            roundMethodType: shareholderRoundingMethod,
          });
        },
        actual: (res) => res.result?.cartinfo?.subtotal_discounts?.[0]?.subtotal_discount_amount,
      }),
    ]);
  });
}

/**
 * @function 有人POSの株主優待（異常系：有効期限ではない）
 * @memberof 売上.販売促進（企画販売）
 * @description
 * {@link TAGS.POS}
 * {@link TAGS.SALES}
 * {@link TAGS.SALES_PROMOTION_PLANNED_SALES}
 * {@link TAGS.SHAREHOLDER_BENEFITS}
 * ### テスト観点
 * * 前提：
 * * * ・株主優待バーコードがm_couponに設定されている。
 * * * かつ、m_coupon.start_datetimeとm_coupon.end_datetimeが有効期限外。
 * * * ・株主優待割許可商品(対象)：m_store_item.allow_shareholder_benefit_type= 1（対象）
 * * * ・株主優待割許可商品(対象外)：m_store_item.allow_shareholder_benefit_type= 2（非対象）
 * * テスト観点：
 * * 株主優待バーコードが有効期限外の場合にエラーになる。
 * 
 * ---
 * ### テスト方法/シナリオ
 * | Step | 手順 | エンドポイント |
 * | :-: | :--- | :--- |
 * | 1 | 取引開始 | `/sales/begin` |
 * | 2 | 株主優待割許可商品(対象)スキャン | `/sales/cart/barcode` |
 * | 3 | 株主優待割許可商品(対象外)スキャン | `/sales/cart/barcode` |
 * | 4 | 小計 | `/sales/subtotal` |
 * | 5 | 株主優待バーコードスキャン　→　エラー終了 | - |
 * 
 * ---
 * ### 前提条件
 * * 特になし
 * 
 * ---
 * ### テストデータ
 * * 1.株主優待割許可商品(対象): 4931290077013
 * * 2.株主優待割許可商品(対象外): 2016020000010
 * * 3.株主優待券（利用期間外）: K20181000
 * 
 * ---
 * ### 期待結果
 * * #### 2.株主優待割許可商品(対象)スキャン `/sales/cart/barcode`
 * * カート情報には 「株主優待割許可商品(対象)」が存在すること確認
 * * * \+ barcode : 4931290077013
 * * #### 3.株主優待割許可商品(対象外)スキャン `/sales/cart/barcode`
 * * カート情報には 「株主優待割許可商品(対象外)」が存在すること確認
 * * * \+ barcode : 2016020000010
 * * 5.株主優待バーコードスキャン　→　エラー終了
 * * \- status code: 220
 * * \- error_message: "このクーポンは現在利用できません（利用期間終了）",
 * * \- error_code: "CPN0003",
 */
export function TC_011946006_ShareholderBenefitOutOfDateHasEmployee() {
  group("TC_011946006 有人POSの株主優待（異常系：有効期限ではない）", () => {
    const step = {
      begin: CommonFunction.getFullDesc(ENDPOINT.SALES_BEGIN),
      barcodeShareholderDiscountAllowed: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "株主優待割許可商品(対象)スキャン"),
      barcodeShareholderDiscountExclude: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "株主優待割許可商品(対象外)スキャン"),
      subtotal: CommonFunction.getFullDesc(ENDPOINT.SALES_SUBTOTAL),
      barcodeShareHolderBenefitsOutOfDate: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "株主優待券（利用期間外スキャン"),
    };

    const cartNo = TestHelper.salesBegin(step.begin, {
      operateEmployeeCd: ENVIRONMENT.EMPLOYEE_BARCODE,
      isSelf: false,
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    TestHelper.salesCartBarcode(step.barcodeShareholderDiscountAllowed, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.SHAREHOLDER_DISCOUNT_ALLOWED,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify the cart info has 株主優待割許可商品(対象): barcode",
        expected: true,
        actual: (res) => CommonFunction.hasItems([
          PROD.SHAREHOLDER_DISCOUNT_ALLOWED,
        ], res.result?.cartinfo?.items),
      }),
    ]);

    TestHelper.salesCartBarcode(step.barcodeShareholderDiscountExclude, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.SHAREHOLDER_DISCOUNT_EXCLUDE,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify the cart info has 株主優待割許可商品(対象外): barcode",
        expected: true,
        actual: (res) => CommonFunction.hasItems([
          PROD.SHAREHOLDER_DISCOUNT_EXCLUDE,
        ], res.result?.cartinfo?.items),
      }),
    ]);

    TestHelper.salesSubtotal(step.subtotal, cartNo, [
      CHECK.createStatusCodeCheck(),
    ]);

    TestHelper.salesCartBarcode(step.barcodeShareHolderBenefitsOutOfDate, {
      cartNo,
      barcodes: [
        {
          barcode: COUPON.SHAREHOLDER_BENEFITS_OUT_OF_DATE.CD,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(220),
      CHECK.createErrorCheck("CPN0003", "このクーポンは現在利用できません（利用期間終了）"),
    ]);
  });
}
