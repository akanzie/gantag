import * as CHECK from "../../../common/common_check.js";
import * as ENVIRONMENT from "../../../common/environment_const.js";
import { group } from "k6";
import * as ENDPOINT from "../../../common/endpoint_const.js";
import * as PROD from "../../../common/constant/product.js";
import { COUPON } from "../../../common/constant/coupon.js";
import { PAID_METHOD } from "../../../common/constant/paid_methods.js";
import { CommonFunction } from "../../../common/common_function.js";
import { TestHelper } from "../../../common/test_helper.js";
import { Formular } from "../../../common/formular.js";
import * as TAGS from "../../../tags/tags_const.js";

/**
 * @function 有人POSの社員割引（正常系）
 * @memberof 売上.販売促進（企画販売）
 * @description
 * {@link TAGS.POS}
 * {@link TAGS.SALES}
 * {@link TAGS.SALES_PROMOTION_PLANNED_SALES}
 * {@link TAGS.COMPANY_DISCOUNT}
 * {@link TAGS.BARCODE_SCAN}
 * ### テスト観点
 * * 小計操作後に社員割引バーコードをスキャンし社員割引が反映される。
 * * * → 社員割引バーコードは金券マスタに社員割引レコードが存在すること。
 * * * → 社割許可商品(対象)：商品マスタの社員割引許可区分が１（対象）
 * * * 社割許可商品(対象外)：商品マスタの社員割引許可区分が２（非対象）
 * * * 社割許可商品(上位参照)：商品マスタの社員割引許可区分が９（上位参照）
 * * * * 　　   該当する中分類マスタの社員割引許可区分が１（対象）
 * * * ・小計に社割の金額が表示される。
 * * * ・商品Aと商品Cが割引され、商品Bは割引されない
 * * 前提：
 * * * ・社員割引バーコードがm_voucherに設定されている。
 * * * ・社割許可商品(対象)：m_store_item.allow_employee_discount_type= 1（対象）
 * * * ・社割許可商品(対象外)：m_store_item.allow_employee_discount_type= 2（非対象）
 * * * ・社割許可商品(上位参照)：m_store_item.allow_employee_discount_type= 9（上位参照）
 * * * * 　  かつ、m_item_category.allow_employee_discount_type= 1（対象）
 * * テスト観点：
 * * * ・小計に社割の金額が表示される。
 * * * ・商品AとCが割引される。
 * * * ・商品Bは割引されない。
 * 
 * ---
 * ### テスト方法/シナリオ
 * | Step | 手順 | エンドポイント |
 * | :-: | :--- | :--- |
 * | 1 | 取引開始 | `/sales/begin` |
 * | 2 | 社割許可商品(対象)スキャン | `/sales/cart/barcode` |
 * | 3 | 社割許可商品(対象外)スキャン | `/sales/cart/barcode` |
 * | 4 | 社割許可商品(上位参照)スキャン | `/sales/cart/barcode` |
 * | 5 | 小計 | `/sales/subtotal` |
 * | 6 | 社員割引バーコードスキャン | - |
 * | 7 | 支払登録 | `/sales/addpayment` |
 * | 8 | 取引完了 | `/sales/end` |
 * 
 * ---
 * ### 前提条件
 * * 特になし
 * 
 * ---
 * ### テストデータ
 * * 1.社割許可商品(対象): 4931290077006
 * * 2.社割許可商品(対象外): 2016020000003
 * * 3.社割許可商品(上位参照): 0017800174527
 * * 4.社員割引券: S01000020W
 * 
 * ---
 * ### 期待結果
 * * #### 2.社割許可商品(対象)スキャン `/sales/cart/barcode`
 * * カート情報の商品を確認
 * * \- 社割許可商品(対象): 4931290077006
 * * #### 3.社割許可商品(対象外)スキャン `/sales/cart/barcode`
 * * カート情報の商品を確認
 * * \- 社割許可商品(対象外): 2016020000003
 * * #### 4. 社割許可商品(上位参照)スキャン `/sales/cart/barcode`
 * * カート情報の商品を確認
 * * \- 社割許可商品(上位参照): 0017800174527
 * * #### 5.小計 `/sales/subtotal`
 * * カート情報を確認
 * * \- total_sales_amount = 1040
 * * \- paid_amount = 0
 * * \- total_balance_amount = 1040
 * * 6.社員割引バーコードスキャン
 * * 社割が適用されること
 * * \- 以下の商品が含まれること:
 * * * \+ 社割許可商品(対象):
 * * * * \. barcode:  4931290077006
 * * * \+ 社割許可商品(対象外)
 * * * * \. barcode:  2016020000003
 * * * \+ 社割許可商品(上位参照)
 * * * * \. barcode:  0017800174527
 * * \- 社割が適用されること
 * * * \+ voucher_cd: S01000020W
 * * * \+ voucher_group_cd: 0609
 * * * \+ voucher_group_name: 社員割引券
 * * \- total_sales_amount = 1040
 * * \- 社割の額が「25」 (社割許可商品(対象) は 社割許可商品(上位参照) 適用される, 社割許可商品(対象外) は適用されない)
 * * * \+ Employee discount amount = Total price of employee discount items × (Voucher Master.Discount Rate ÷ 100)
 * * * \+ Employee discount amount = (社割許可商品(対象)+ 社割許可商品(対象外)) × (Voucher Master.Discount Rate ÷ 100) = (198+298)x5÷ 100 = 24.8
 * * * \+ Voucher Master.RoundingMethod Type is rounding up (1) => discount amount = 25
 * * \- total_balance_amount =　社員割引適用前 - 割引額 = 1040-25 = 1015
 * * #### 8.取引完了 `/sales/end`
 * * レシートに以下の商品が含まれる
 * * \- Barcode: 4931290077006, 2016020000003, 0017800174527
 */
export function TC_011952004_CheckPosEmployeeDiscountNormal() {
  group("TC_011952004 有人POSの社員割引（正常系）", () => {
    const step = {
      begin: CommonFunction.getFullDesc(ENDPOINT.SALES_BEGIN),
      barcodeEmployeeDiscountAllowed: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "社割許可商品(対象)スキャン"),
      barcodeEmployeeDiscountExclude: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "社割許可商品(対象外)スキャン"),
      barcodeEmployeeDiscountReferUpper: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "社割許可商品(上位参照)スキャン"),
      subtotal: CommonFunction.getFullDesc(ENDPOINT.SALES_SUBTOTAL),
      barcodeEmployeeDiscount: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "社員割引バーコードスキャン"),
      payment: CommonFunction.getFullDesc(ENDPOINT.SALES_ADDPAYMENT),
      end: CommonFunction.getFullDesc(ENDPOINT.SALES_END),
    };

    // 1.取引開始 /sales/begin
    const cartNo = TestHelper.salesBegin(step.begin, {
      operateEmployeeCd: ENVIRONMENT.EMPLOYEE_CD,
      isSelf: false,
      terminalId: ENVIRONMENT.TERMINAL_ID,
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    // 2.社割許可商品(対象)スキャン /sales/cart/barcode
    TestHelper.salesCartBarcode(step.barcodeEmployeeDiscountAllowed, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.EMPLOYEE_DISCOUNT_ALLOWED,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify 社割許可商品(対象): barcode",
        expected: PROD.EMPLOYEE_DISCOUNT_ALLOWED,
        actual: (res) => res.result?.cartinfo?.items?.[0]?.barcode,
      }),
    ]);

    // 3.社割許可商品(対象外)スキャン /sales/cart/barcode
    TestHelper.salesCartBarcode(step.barcodeEmployeeDiscountExclude, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.EMPLOYEE_DISCOUNT_EXCLUDE,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify 社割許可商品(対象外): barcode",
        expected: PROD.EMPLOYEE_DISCOUNT_EXCLUDE,
        actual: (res) => res.result?.cartinfo?.items?.[1]?.barcode,
      }),
    ]);

    // 4.社割許可商品(上位参照)スキャン /sales/cart/barcode
    TestHelper.salesCartBarcode(step.barcodeEmployeeDiscountReferUpper, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.EMPLOYEE_DISCOUNT_REFER_UPPER,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify 社割許可商品(上位参照): barcode",
        expected: PROD.EMPLOYEE_DISCOUNT_REFER_UPPER,
        actual: (res) => res.result?.cartinfo?.items?.[2]?.barcode,
      }),
    ]);

    // 5.小計 /sales/subtotal
    const totalBalanceAmount = TestHelper.salesSubtotal(step.subtotal, cartNo, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify total sales amount",
        expected: (res) => Formular.calcTotalSalesAmount(res.result?.cartinfo?.items),
        actual: (res) => res.result?.cartinfo?.total_sales_amount,
      }),
      CHECK.createEqualsCheck({
        name: "Verify total paid amount",
        expected: 0, // not paid yet in subtotal
        actual: (res) => res.result?.cartinfo?.total_paid_amount,
      }),
      CHECK.createEqualsCheck({
        name: "Verify total balance amount",
        expected: (res) => Formular.calcTotalSalesAmount(res.result?.cartinfo?.items),
        actual: (res) => res.result?.cartinfo?.total_balance_amount,
      }),
    ]).result?.cartinfo?.total_balance_amount;

    // 6.社員割引バーコードスキャン /sales/cart/barcode
    TestHelper.salesCartBarcode(step.barcodeEmployeeDiscount, {
      cartNo,
      barcodes: [
        {
          barcode: COUPON.EMPLOYEE_DISCOUNT.CD,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "The cart info contains has 3 scanned items",
        expected: true,
        actual: (res) => CommonFunction.hasItems([
          PROD.EMPLOYEE_DISCOUNT_ALLOWED,
          PROD.EMPLOYEE_DISCOUNT_EXCLUDE,
          PROD.EMPLOYEE_DISCOUNT_REFER_UPPER,
        ], res.result?.cartinfo?.items),
      }),
      CHECK.createEqualsCheck({
        name: "The employee discount has been applied",
        expected: {
          voucherCd: COUPON.EMPLOYEE_DISCOUNT.CD,
          voucherGroupCd: COUPON.EMPLOYEE_DISCOUNT.GROUP_CD,
          voucherGroupName: COUPON.EMPLOYEE_DISCOUNT.NAME,
        },
        actual: (res) => {
          return {
            voucherCd: res.result?.cartinfo?.payments?.[0]?.voucher_cd,
            voucherGroupCd: res.result?.cartinfo?.payments?.[0]?.voucher_group_cd,
            voucherGroupName: res.result?.cartinfo?.payments?.[0]?.voucher_group_name,
          };
        },
      }),
      CHECK.createEqualsCheck({
        name: "Verify total sales amount",
        expected: (res) => Formular.calcTotalSalesAmount(res.result?.cartinfo?.items),
        actual: (res) => res.result?.cartinfo?.total_sales_amount,
      }),
      CHECK.createEqualsCheck({
        name: "Verify employee discount amount",
        expected: (res) => {
          const totalPriceTargetItems = (res.result?.cartinfo?.items?.[0]?.display_unit_price ?? 0) + (res.result?.cartinfo?.items?.[2]?.display_unit_price ?? 0);
          const employeeDiscountAmount = Math.ceil(totalPriceTargetItems * COUPON.EMPLOYEE_DISCOUNT.DISCOUNT_RATE / 100);
          return employeeDiscountAmount;
        },
        actual: (res) => res.result?.cartinfo?.payments?.[0]?.paid_amount,
      }),
      CHECK.createEqualsCheck({
        name: "Verify total balance amount",
        expected: (res) => {
          const totalPriceTargetItems = (res.result?.cartinfo?.items?.[0]?.display_unit_price ?? 0) + (res.result?.cartinfo?.items?.[2]?.display_unit_price ?? 0);
          const employeeDiscountAmount = Math.ceil(totalPriceTargetItems * COUPON.EMPLOYEE_DISCOUNT.DISCOUNT_RATE / 100);
          return Formular.calcTotalSalesAmount(res.result?.cartinfo?.items) - employeeDiscountAmount;
        },
        actual: (res) => res.result?.cartinfo?.total_balance_amount,
      }),
    ]);

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
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Receipt data must contain 3 scanned items",
        expected: true,
        actual: (res) => CommonFunction.includesItems([
          PROD.EMPLOYEE_DISCOUNT_ALLOWED,
          PROD.EMPLOYEE_DISCOUNT_EXCLUDE,
          PROD.EMPLOYEE_DISCOUNT_REFER_UPPER,
        ], res.result?.receipts?.[0]?.receipt_data),
      }),
    ]);
  });
}

/**
 * @function 有人POSの社員割引（異常系：有効期限ではない）
 * @memberof 売上.販売促進（企画販売）
 * @description
 * {@link TAGS.POS}
 * {@link TAGS.SALES}
 * {@link TAGS.SALES_PROMOTION_PLANNED_SALES}
 * {@link TAGS.COMPANY_DISCOUNT}
 * {@link TAGS.EXPIRY_DATE_CHECK}
 * ### テスト観点
 * * 小計操作後に社員割引バーコードをスキャンし有効期限エラーとなる。
 * * * → 社員割引バーコードは金券マスタに社員割引レコードが存在し、
 * * * 有効期限が範囲外のもの。
 * * * → 社割許可商品(対象)：商品マスタの社員割引許可区分が１（対象）
 * * * 社割許可商品(対象外)：商品マスタの社員割引許可区分が２（非対象）　
 * * 前提：
 * * * ・社員割引バーコードがm_voucherに設定されている。
 * * * かつ、m_voucher.start_datetimeとm_voucher.end_datetimeが有効期限外。
 * * * ・社割許可商品(対象)：m_store_item.allow_employee_discount_type= 1（対象）
 * * * ・社割許可商品(対象外)：m_store_item.allow_employee_discount_type= 2（非対象）
 * * テスト観点：
 * * 社員割引バーコードが利用期間外の場合にエラーになる。
 * 
 * ---
 * ### テスト方法/シナリオ
 * | Step | 手順 | エンドポイント |
 * | :-: | :--- | :--- |
 * | 1 | 取引開始 | `/sales/begin` |
 * | 2 | 社割許可商品(対象)スキャン | `/sales/cart/barcode` |
 * | 3 | 社割許可商品(対象外)スキャン | `/sales/cart/barcode` |
 * | 4 | 小計 | `/sales/subtotal` |
 * | 5 | 社員割引バーコードスキャン　→　エラー終了 | - |
 * 
 * ---
 * ### 前提条件
 * * 特になし
 * 
 * ---
 * ### テストデータ
 * * 1. 社割許可商品(対象): 4931290077006
 * * 2. 社割許可商品(対象外): 2016020000003
 * * 3. 社員割引券（利用期間外）: S20231101W
 * 
 * ---
 * ### 期待結果
 * * #### 2.社割許可商品(対象)スキャン `/sales/cart/barcode`
 * * カート情報の商品を確認
 * * \- 社割許可商品(対象): 4931290077006
 * * #### 3.社割許可商品(対象外)スキャン `/sales/cart/barcode`
 * * カート情報の商品を確認
 * * \- 社割許可商品(対象外): 2016020000003
 * * #### 4.小計 `/sales/subtotal`
 * * 社割が適用されること
 * * \- 以下の商品が含まれること:
 * * * \+ 社割許可商品(対象):
 * * * * \. barcode:  4931290077006
 * * * \+ 社割許可商品(対象外)
 * * * * \. barcode:  2016020000003
 * * 5.社員割引バーコードスキャン　→　エラー終了
 * * \-  status code: 220
 * * \- error_message: "この金券は現在利用できません（利用期間終了）",
 * * \- error_code: "VUC0003","
 */
export function TC_011952005_CheckPosEmployeeDiscountExpiration() {
  group("TC_011952005 有人POSの社員割引（異常系：有効期限ではない）", () => {
    const step = {
      begin: CommonFunction.getFullDesc(ENDPOINT.SALES_BEGIN),
      barcode1: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "社割許可商品(対象)スキャン"),
      barcode2: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "社割許可商品(対象外)スキャン"),
      barcode3: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "社割許可商品(上位参照)スキャン"),
      subtotal: CommonFunction.getFullDesc(ENDPOINT.SALES_SUBTOTAL),
      barcode4: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "社員割引バーコードスキャン"),
      payment: CommonFunction.getFullDesc(ENDPOINT.SALES_ADDPAYMENT),
      end: CommonFunction.getFullDesc(ENDPOINT.SALES_END),
    };

    // 1.取引開始 /sales/begin
    const cartNo = TestHelper.salesBegin(step.begin, {
      signnedEmployeeCd: "",
      operateEmployeeCd: ENVIRONMENT.EMPLOYEE_CD,
      isSelf: false,
      terminalId: ENVIRONMENT.TERMINAL_ID,
    }, [
      CHECK.createStatusCodeCheck(),
    ]);
    // 2.社割許可商品(対象)スキャン /sales/cart/barcode
    TestHelper.salesCartBarcode(step.barcode1, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.EMPLOYEE_DISCOUNT_ALLOWED,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify the cart info contains 社割許可商品(対象): barcode",
        expected: PROD.EMPLOYEE_DISCOUNT_ALLOWED,
        actual: (res) => res.result?.cartinfo?.items?.[0]?.barcode,
      }),
    ]);
    // 3.社割許可商品(対象外)スキャン /sales/cart/barcode
    TestHelper.salesCartBarcode(step.barcode2, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.EMPLOYEE_DISCOUNT_EXCLUDE,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify the cart info contains 社割許可商品(対象外): barcode",
        expected: PROD.EMPLOYEE_DISCOUNT_EXCLUDE,
        actual: (res) => res.result?.cartinfo?.items?.[1]?.barcode,
      }),
    ]);
    // 4.小計 /sales/subtotal
    TestHelper.salesSubtotal(step.subtotal, cartNo, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify items length equals 2",
        expected: 2,
        actual: (res) => res.result?.cartinfo?.items?.length,
      }),
      CHECK.createEqualsCheck({
        name: "Verify the cart info contains 社割許可商品(対象): barcode",
        expected: PROD.EMPLOYEE_DISCOUNT_ALLOWED,
        actual: (res) => res.result?.cartinfo?.items?.[0]?.barcode,
      }),
      CHECK.createEqualsCheck({
        name: "Verify the cart info contains 社割許可商品(対象外): barcode",
        expected: PROD.EMPLOYEE_DISCOUNT_EXCLUDE,
        actual: (res) => res.result?.cartinfo?.items?.[1]?.barcode,
      }),
    ]);
    // 5.社員割引バーコードスキャン　→　エラー終了
    TestHelper.salesCartBarcode(step.barcode4, {
      cartNo,
      barcodes: [
        {
          barcode: COUPON.EXPIRED_EMPLOYEE_DISCOUNT.CD,
          scan_data_type: "Code39",
        },
      ],
      barcodeOperationType: 3,
    }, [
      CHECK.createStatusCodeCheck(220),
      CHECK.createErrorCheck("VUC0003", "この金券は現在利用できません（利用期間終了）"),
    ]);
  });
}

/**
 * @function セルフPOSの社員割引（正常系）
 * @memberof 売上.販売促進（企画販売）
 * @description
 * {@link TAGS.POS}
 * {@link TAGS.SALES}
 * {@link TAGS.SALES_PROMOTION_PLANNED_SALES}
 * {@link TAGS.COMPANY_DISCOUNT}
 * {@link TAGS.BARCODE_SCAN}
 * ### テスト観点
 * * 商品登録画面で社員割引バーコードをスキャンし社員割引が反映される。
 * * * → 社員割引バーコードは金券マスタに社員割引レコードが存在すること。
 * * * → 社割許可商品(対象)：商品マスタの社員割引許可区分が１（対象）
 * * * 社割許可商品(対象外)：商品マスタの社員割引許可区分が２（非対象）
 * * * * 　　   商品券、たばこ、ハガキ、切手、書籍など。
 * * * 社割許可商品(上位参照)：商品マスタの社員割引許可区分が９（上位参照）
 * * * * 　　   該当する中分類マスタの社員割引許可区分が１（対象）
 * * * ・小計に社割の金額が表示される。
 * * * ・商品Aと商品Cが割引され、商品Bは割引されない
 * 
 * ---
 * ### テスト方法/シナリオ
 * | Step | 手順 | エンドポイント |
 * | :-: | :--- | :--- |
 * | 1 | 取引開始 | `/sales/begin` |
 * | 2 | 社割許可商品(対象)スキャン | `/sales/cart/barcode` |
 * | 3 | 社割許可商品(対象外)スキャン | `/sales/cart/barcode` |
 * | 4 | 社員割引バーコードスキャン | - |
 * | 5 | 社割許可商品(上位参照)スキャン | `/sales/cart/barcode` |
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
 * * 1. 社割許可商品(対象): 4931290077006
 * * 2. 社割許可商品(対象外): 2016020000003
 * * 3. 社員割引券 : S01000020W
 * * 4. 社割許可商品(上位参照): 0017800174527
 * 
 * ---
 * ### 期待結果
 * * #### 2.社割許可商品(対象)スキャン `/sales/cart/barcode`
 * * カート情報の商品を確認
 * * \- 社割許可商品(対象)
 * * * \+ barcode : 4931290077006
 * * #### 3.社割許可商品(対象外)スキャン `/sales/cart/barcode`
 * * カート情報の商品を確認
 * * \- 社割許可商品(対象外)
 * * * \+ barcode : 2016020000003
 * * 4.社員割引バーコードスキャン
 * * カート情報の支払明細リストを確認
 * * \- 社割が適用されること
 * * * \+ voucher_cd: S01000020W
 * * * \+ voucher_group_cd: 0609
 * * * \+ voucher_group_name: 社員割引券
 * * \- total_sales_amount = 713
 * * \- 社割の額が「10」
 * * * \+ Employee discount amount = Total price of employee discount items × (Voucher Master.Discount Rate ÷ 100)
 * * * \+ Employee discount amount = item A  × (Voucher Master.Discount Rate ÷ 100) = 198x5÷ 100 = 9.9
 * * * \+ Voucher Master.RoundingMethod Type is rounding up, so the Employee discount amount is 10
 * * \- total_balance_amount_is 703
 * * #### 5.社割許可商品(上位参照)スキャン `/sales/cart/barcode`
 * * カート情報を確認
 * * \- 社割許可商品(上位参照)が含まれる
 * * * \+ barcode : 0017800174527
 * * \- 社割が適用されること
 * * * \+ voucher_cd: S01000020W
 * * * \+ voucher_group_cd: 0609
 * * * \+ voucher_group_name: 社員割引券
 * * \- total_sales_amount = 1040
 * * \- 社割の額が「25」
 * * * \+ Employee discount amount = Total price of employee discount items × (Voucher Master.Discount Rate ÷ 100)
 * * * \+ Employee discount amount = (item A + Item C) × (Voucher Master.Discount Rate ÷ 100) = (198+298)x5÷ 100 = 24.8
 * * * \+ Voucher Master.RoundingMethod Type is rounding up , so the Employee discount amount is 25
 * * \- total_balance_amount = 1015
 * * #### 6.小計 `/sales/subtotal`
 * * カート情報を確認
 * * \- 社割が適用されること
 * * * \+ voucher_cd: S01000020W
 * * * \+ voucher_group_cd: 0609
 * * * \+ voucher_group_name: 社員割引券
 * * \- total sales amount amount = 1040
 * * \- 社割の額が「25」
 * * * \+ Employee discount amount = Total price of employee discount items × (Voucher Master.Discount Rate ÷ 100)
 * * * \+ Employee discount amount = (item A + Item C) × (Voucher Master.Discount Rate ÷ 100) = (198+298)x5÷ 100 = 24.8
 * * * \+ Voucher Master.RoundingMethod Type is rounding up, so the Employee discount amount is 25
 * * \- total_balance_amount is 1015
 * * #### 8.取引完了 `/sales/end`
 * * レシートに以下の商品が含まれる
 * * \- Barcode: 4931290077006, 2016020000003, 0017800174527
 */
export function TC_011952001_CheckSelfPOSDiscountForEmployee() {
  group("TC_011952001 セルフPOSの社員割引（正常系）", () => {
    const step = {
      begin: CommonFunction.getFullDesc(ENDPOINT.SALES_BEGIN),
      barcodeEmployeeDiscountAllowed: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "社割許可商品(対象)スキャン"),
      barcodeEmployeeDiscountExclude: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "社割許可商品(対象外)スキャン"),
      barcodeEmployeeDiscount: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "社員割引バーコードスキャン"),
      barcodeEmployeeDiscountReferUpper: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "社割許可商品(上位参照)スキャン"),
      subtotal: CommonFunction.getFullDesc(ENDPOINT.SALES_SUBTOTAL),
      payment: CommonFunction.getFullDesc(ENDPOINT.SALES_ADDPAYMENT),
      end: CommonFunction.getFullDesc(ENDPOINT.SALES_END),
    };

    // 1.取引開始 /sales/begin
    const cartNo = TestHelper.salesBegin(step.begin, {}, [
      CHECK.createStatusCodeCheck(),
    ]);

    // 2. 社割許可商品(対象)スキャン /sales/cart/barcode
    TestHelper.salesCartBarcode(step.barcodeEmployeeDiscountAllowed, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.EMPLOYEE_DISCOUNT_ALLOWED,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify the cart info contains 社割許可商品(対象) barcode",
        expected: PROD.EMPLOYEE_DISCOUNT_ALLOWED,
        actual: (res) => res.result?.cartinfo?.items?.[0]?.barcode,
      }),
    ]);

    // 3.社割許可商品(対象外)スキャン /sales/cart/barcode
    TestHelper.salesCartBarcode(step.barcodeEmployeeDiscountExclude, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.EMPLOYEE_DISCOUNT_EXCLUDE,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify the cart info contains 社割許可商品(対象外) barcode",
        expected: PROD.EMPLOYEE_DISCOUNT_EXCLUDE,
        actual: (res) => res.result?.cartinfo?.items?.[1]?.barcode,
      }),
    ]);

    // 4.社員割引バーコードスキャン /sales/cart/barcode
    TestHelper.salesCartBarcode(step.barcodeEmployeeDiscount, {
      cartNo,
      barcodes: [
        {
          barcode: COUPON.EMPLOYEE_DISCOUNT.CD,
          scan_data_type: "Code39",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify employee discount has been applied",
        expected: {
          voucherCd: COUPON.EMPLOYEE_DISCOUNT.CD,
          voucherGroupCd: COUPON.EMPLOYEE_DISCOUNT.GROUP_CD,
          voucherGroupName: COUPON.EMPLOYEE_DISCOUNT.NAME,
        },
        actual: (res) => {
          const cartinfo = res.result?.cartinfo;
          const payment = cartinfo?.payments?.[0];
          return {
            voucherCd: payment?.voucher_cd,
            voucherGroupCd: payment?.voucher_group_cd,
            voucherGroupName: payment?.voucher_group_name,
          };
        },
      }),
      CHECK.createEqualsCheck({
        name: "Verify total sales amount",
        expected: (res) => Formular.calcTotalSalesAmount(res.result?.cartinfo?.items),
        actual: (res) => res.result?.cartinfo?.total_sales_amount,
      }),
      CHECK.createEqualsCheck({
        name: "Verify the employee discount amount",
        expected: (res) => Math.ceil(res.result?.cartinfo?.items?.[0]?.display_unit_price * COUPON.EMPLOYEE_DISCOUNT.DISCOUNT_RATE / 100),
        actual: (res) => res.result?.cartinfo?.payments?.[0]?.paid_amount,
      }),
      CHECK.createEqualsCheck({
        name: "Verify total balance amount",
        expected: (res) => {
          const employeeDiscountAmount = Math.ceil(res.result?.cartinfo?.items?.[0]?.display_unit_price * COUPON.EMPLOYEE_DISCOUNT.DISCOUNT_RATE / 100);
          return Formular.calcTotalSalesAmount(res.result?.cartinfo?.items) - employeeDiscountAmount;
        },
        actual: (res) => res.result?.cartinfo?.total_balance_amount,
      }),
    ]);

    // 5.社割許可商品(上位参照)スキャン /sales/cart/barcode
    TestHelper.salesCartBarcode(step.barcodeEmployeeDiscountReferUpper, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.EMPLOYEE_DISCOUNT_REFER_UPPER,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify the cart info contains 社割許可商品(上位参照) barcode",
        expected: PROD.EMPLOYEE_DISCOUNT_REFER_UPPER,
        actual: (res) => res.result?.cartinfo?.items?.[2]?.barcode,
      }),
      CHECK.createEqualsCheck({
        name: "Verify employee discount has been applied",
        expected: {
          voucherCd: COUPON.EMPLOYEE_DISCOUNT.CD,
          voucherGroupCd: COUPON.EMPLOYEE_DISCOUNT.GROUP_CD,
          voucherGroupName: COUPON.EMPLOYEE_DISCOUNT.NAME,
        },
        actual: (res) => {
          const cartinfo = res.result?.cartinfo;
          const payment = cartinfo?.payments?.[0];
          return {
            voucherCd: payment?.voucher_cd,
            voucherGroupCd: payment?.voucher_group_cd,
            voucherGroupName: payment?.voucher_group_name,
          };
        },
      }),
      CHECK.createEqualsCheck({
        name: "Verify total sales amount",
        expected: (res) => Formular.calcTotalSalesAmount(res.result?.cartinfo?.items),
        actual: (res) => res.result?.cartinfo?.total_sales_amount,
      }),
      CHECK.createEqualsCheck({
        name: "Verify the employee discount amount",
        expected: (res) => {
          const totalPriceTargetItems = res.result?.cartinfo?.items?.[0]?.display_unit_price + res.result?.cartinfo?.items?.[2]?.display_unit_price;
          const employeeDiscountAmount = Math.ceil(totalPriceTargetItems * COUPON.EMPLOYEE_DISCOUNT.DISCOUNT_RATE / 100);
          return employeeDiscountAmount;
        },
        actual: (res) => res.result?.cartinfo?.payments?.[0]?.paid_amount,
      }),
      CHECK.createEqualsCheck({
        name: "Verify total balance amount",
        expected: (res) => {
          const totalPriceTargetItems = res.result?.cartinfo?.items?.[0]?.display_unit_price + res.result?.cartinfo?.items?.[2]?.display_unit_price;
          const employeeDiscountAmount = Math.ceil(totalPriceTargetItems * COUPON.EMPLOYEE_DISCOUNT.DISCOUNT_RATE / 100);
          return Formular.calcTotalSalesAmount(res.result?.cartinfo?.items) - employeeDiscountAmount;
        },
        actual: (res) => res.result?.cartinfo?.total_balance_amount,
      }),
    ]);

    // 6.小計 /sales/subtotal
    const totalBalanceAmount = TestHelper.salesSubtotal(step.subtotal, cartNo, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify employee discount has been applied",
        expected: {
          voucherCd: COUPON.EMPLOYEE_DISCOUNT.CD,
          voucherGroupCd: COUPON.EMPLOYEE_DISCOUNT.GROUP_CD,
          voucherGroupName: COUPON.EMPLOYEE_DISCOUNT.NAME,
        },
        actual: (res) => {
          const cartinfo = res.result?.cartinfo;
          const payment = cartinfo?.payments?.[0];
          return {
            voucherCd: payment?.voucher_cd,
            voucherGroupCd: payment?.voucher_group_cd,
            voucherGroupName: payment?.voucher_group_name,
          };
        },
      }),
      CHECK.createEqualsCheck({
        name: "Verify total sales amount",
        expected: (res) => Formular.calcTotalSalesAmount(res.result?.cartinfo?.items),
        actual: (res) => res.result?.cartinfo?.total_sales_amount,
      }),
      CHECK.createEqualsCheck({
        name: "Verify the employee discount amount",
        expected: (res) => {
          const totalPriceTargetItems = res.result?.cartinfo?.items?.[0]?.display_unit_price + res.result?.cartinfo?.items?.[2]?.display_unit_price;
          const employeeDiscountAmount = Math.ceil(totalPriceTargetItems * COUPON.EMPLOYEE_DISCOUNT.DISCOUNT_RATE / 100);
          return employeeDiscountAmount;
        },
        actual: (res) => res.result?.cartinfo?.payments?.[0]?.paid_amount,
      }),
      CHECK.createEqualsCheck({
        name: "Verify total balance amount",
        expected: (res) => {
          const totalPriceTargetItems = res.result?.cartinfo?.items?.[0]?.display_unit_price + res.result?.cartinfo?.items?.[2]?.display_unit_price;
          const employeeDiscountAmount = Math.ceil(totalPriceTargetItems * COUPON.EMPLOYEE_DISCOUNT.DISCOUNT_RATE / 100);
          return Formular.calcTotalSalesAmount(res.result?.cartinfo?.items) - employeeDiscountAmount;
        },
        actual: (res) => res.result?.cartinfo?.total_balance_amount,
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
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Receipt data must contains 社割許可商品(対象), 社割許可商品(対象外) and 社割許可商品(上位参照) barcode",
        expected: true,
        actual: (res) => CommonFunction.includesItems([
          PROD.EMPLOYEE_DISCOUNT_ALLOWED,
          PROD.EMPLOYEE_DISCOUNT_EXCLUDE,
          PROD.EMPLOYEE_DISCOUNT_REFER_UPPER,
        ], res.result?.receipts?.[0]?.receipt_data),
      }),
    ]);
  });
}

/**
 * @function セルフPOSの社割・株主優待の併用
 * @memberof 売上.販売促進（企画販売）
 * @description
 * {@link TAGS.POS}
 * {@link TAGS.SALES}
 * {@link TAGS.SALES_PROMOTION_PLANNED_SALES}
 * {@link TAGS.COMPANY_DISCOUNT}
 * {@link TAGS.SHAREHOLDER_BENEFITS}
 * ### テスト観点
 * * 前提：
 * * * ・社員割引バーコードがm_voucherに設定されている。
 * * * ・株主優待バーコードがm_couponに設定されている。
 * * * ・社割許可商品(対象)：m_store_item.allow_employee_discount_type= 1（対象）
 * * * ・社割許可商品(対象外)：m_store_item.allow_employee_discount_type= 2（非対象）
 * * * ・社割許可商品(上位参照)：m_store_item.allow_employee_discount_type= 9（上位参照）
 * * * * 　  かつ、m_item_category.allow_employee_discount_type= 1（対象）
 * * * ・株主優待割許可商品(対象)：m_store_item.allow_shareholder_benefit_type= 1（対象）
 * * * ・株主優待割許可商品(対象外)：m_store_item.allow_shareholder_benefit_type= 2（非対象）
 * * * ・株主優待割許可商品(上位参照)：m_store_item.allow_shareholder_benefit_type= 9（上位参照）
 * * * * 　  かつ、m_item_category.allow_shareholder_benefit_type= 1（対象）
 * * テスト観点：
 * * 商品登録画面で社員割引と株主優待のバーコードをスキャンし社員割引と株主優待の両方が反映される。
 * * * ・小計に社員割引と株主優待の金額が表示される。
 * * * ・割引は株主優待→社員割引の優先順位で割引される。
 * * * ・商品Bと商品Eは割引されない
 * 
 * ---
 * ### テスト方法/シナリオ
 * | Step | 手順 | エンドポイント |
 * | :-: | :--- | :--- |
 * | 1 | 取引開始 | `/sales/begin` |
 * | 2 | 社割許可商品(対象)スキャン | `/sales/cart/barcode` |
 * | 3 | 社割許可商品(対象外)スキャン | `/sales/cart/barcode` |
 * | 4 | 社員割引バーコードスキャン | - |
 * | 5 | 社割許可商品(上位参照)スキャン | `/sales/cart/barcode` |
 * | 6 | 株主優待割許可商品(対象)スキャン | `/sales/cart/barcode` |
 * | 7 | 株主優待割許可商品(対象外)スキャン | `/sales/cart/barcode` |
 * | 8 | 株主優待割許可商品(上位参照)スキャン | `/sales/cart/barcode` |
 * | 9 | 株主優待バーコードスキャン | - |
 * | 10 | 小計 | `/sales/subtotal` |
 * 
 * ---
 * ### 前提条件
 * * 特になし
 * 
 * ---
 * ### テストデータ
 * * 1. 社割許可商品(対象): 4931290077006
 * * 2. 社割許可商品(対象外): 2016020000003
 * * 3. 社割許可商品(上位参照): 0017800174527
 * * 4. 株主優待割許可商品(対象): 4931290077013
 * * 5. 株主優待割許可商品(対象外): 2016020000010
 * * 6. 株主優待割許可商品(上位参照): 0019014614035
 * * 7. 社員割引券: S01000020W
 * * 8. 株主優待: K20180900
 * 
 * ---
 * ### 期待結果
 * * 4.社員割引バーコードスキャン
 * * \- 社員割引が適用されていることを確認
 * * * \+ voucher_cd: S01000020W
 * * * \+ voucher_group_cd: 0609
 * * * \+ voucher_group_name: 社員割引券
 * * 9.株主優待バーコードスキャン
 * * \- 株主優待割引が適用されていることを確認
 * * * \+ subtotal_discount_cd: 2004
 * * * \+ subtotal_discount_name: 株主優待
 * * * \+ subtotal_discount_rate: 5
 * * #### 10.小計 `/sales/subtotal`
 * * \- 株主優待割引の検証は、社割許可商品(対象)、社割許可商品(上位参照)、株主優待割許可商品(対象)、株主優待割許可商品(上位参照)にのみ適用され、社割許可商品(対象外)、株主優待割許可商品(対象外)には適用されないことを確認
 * * * \+ subtotal_discounts.target_items に 社割許可商品(対象)、社割許可商品(上位参照)、株主優待割許可商品(対象)、株主優待割許可商品(上位参照) が含まれること
 * * * \+ subtotal_discounts.non_target_items に 社割許可商品(対象外)、株主優待割許可商品(対象外) が含まれること
 * * \- 株主優待割引金額が233であることを確認
 * * * \+ 株主優待割引金額 = 株主優待割引対象商品の合計金額 × (クーポンマスタ.割引率 ÷ 100)
 * * * \+ 株主優待割引金額 = (社割許可商品(対象) + 社割許可商品(上位参照) + 株主優待割許可商品(対象) + 株主優待割許可商品(上位参照)) x 5 ÷ 100 = (198 + 298 + 198 + 3980) x 5 ÷ 100 = 4674 x 5 ÷ 100 = 233.7
 * * * \+ SubtotalDiscountRoundingMethodType は切り捨て、SubtotalDiscountRoundingDigitType は小数第1位のため、株主優待割引金額は233となる
 * * \- 社員割引金額が223であることを確認（社割許可商品(対象)、社割許可商品(上位参照)、株主優待割許可商品(対象)、株主優待割許可商品(上位参照)が割引され、社割許可商品(対象外)、株主優待割許可商品(対象外)は割引されない）
 * * * \+ アイテムの小計割引按分額 = 株主優待割引小計割引額 × アイテム単価 ÷ 小計割引対象合計金額
 * * * * \. SubtotalDiscountRoundingMethodType は切り捨て、SubtotalDiscountRoundingDigitType は小数第1位
 * * * * \. 小計割引按分額(社割許可商品(対象)) = 233 * 198 ÷ 4674 = 9
 * * * * \. 小計割引按分額(社割許可商品(上位参照)) = 233 * 298 ÷ 4674 = 14
 * * * * \. 小計割引按分額(株主優待割許可商品(対象)) = 233 * 198 ÷ 4674 = 9
 * * * * \. 小計割引按分額(株主優待割許可商品(上位参照)) = 233 * 3980 ÷ 4674 = 198
 * * * \+ 小計割引の端数 = 小計割引額 - アイテムの小計割引按分額合計 = 233-(9+14+9+198) = 3
 * * * \+ 小計割引の余りは3円であり、小計割引対象商品が3つあるため、端数配分優先順位（株主優待割許可商品(上位参照)、社割許可商品(上位参照)、社割許可商品(対象)）に従って配分
 * * * * \. 株主優待割引額(社割許可商品(対象)) = 9 + 1 = 10
 * * * * \. 株主優待割引額(社割許可商品(上位参照)) = 14 + 1 = 15
 * * * * \. 株主優待割引額(株主優待割許可商品(対象)) = 9 + 0 = 9
 * * * * \. 株主優待割引額(株主優待割許可商品(上位参照)) = 198 + 1 = 199
 * * * \+ 社員割引金額 = 株主優待割引後の商品合計金額 × (バウチャーマスタ.割引率 ÷ 100)
 * * * * \. (単価(社割許可商品(対象)) - 株主優待割引額(社割許可商品(対象))) + (単価(社割許可商品(上位参照)) - 株主優待割引額(社割許可商品(上位参照))) + (単価(株主優待割許可商品(対象)) - 株主優待割引額(株主優待割許可商品(対象))) + (単価(株主優待割許可商品(上位参照)) - 株主優待割引額(株主優待割許可商品(上位参照))) = (198 -10 + 298 - 15 + 198 - 9 + 3980 - 199) x 5 ÷ 100 = 222.05
 * * * * \. バウチャーマスタ.RoundingMethod のタイプ は切り上げのため、社員割引金額は223となる
 */
export function TC_011952007_ApplyEmployeeAndShareholderDiscountsSelfPOS() {
  group("TC_011952007 セルフPOSの社割・株主優待の併用", () => {
    const step = {
      begin: CommonFunction.getFullDesc(ENDPOINT.SALES_BEGIN),
      barcodeEmployeeDiscountAllowed: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "社割許可商品(対象)スキャン"),
      barcodeEmployeeDiscountExclude: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "社割許可商品(対象外)スキャン"),
      barcodeEmployeeDiscount: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "社員割引バーコードスキャン"),
      barcodeEmployeeDiscountReferUpper: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "社割許可商品(上位参照)スキャン"),
      barcodeShareholderDiscountAllowed: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "株主優待割許可商品(対象)スキャン"),
      barcodeShareholderDiscountExclude: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "株主優待割許可商品(対象外)スキャン"),
      barcodeShareholderDiscountReferUpper: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "株主優待割許可商品(上位参照)スキャン"),
      barcodeShareholderBenefits: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "株主優待バーコードスキャン"),
      subtotal: CommonFunction.getFullDesc(ENDPOINT.SALES_SUBTOTAL),
    };

    const employeeRoundingMethod = 1; // Specified in master, RoundingMethod Type is rounding up
    const shareholderRoundingMethod = 2; // Specified in master, RoundingMethod Type is rounding down

    // 1.取引開始 /sales/begin
    const cartNo = TestHelper.salesBegin(step.begin, {}, [
      CHECK.createStatusCodeCheck(),
    ]);
    // 2. 社割許可商品(対象)スキャン /sales/cart/barcode
    TestHelper.salesCartBarcode(step.barcodeEmployeeDiscountAllowed, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.EMPLOYEE_DISCOUNT_ALLOWED,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
    ]);
    // 3.社割許可商品(対象外)スキャン /sales/cart/barcode
    TestHelper.salesCartBarcode(step.barcodeEmployeeDiscountExclude, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.EMPLOYEE_DISCOUNT_EXCLUDE,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
    ]);
    // 4.社員割引バーコードスキャン /sales/cart/barcode
    TestHelper.salesCartBarcode(step.barcodeEmployeeDiscount, {
      cartNo,
      barcodes: [
        {
          barcode: COUPON.EMPLOYEE_DISCOUNT.CD,
          scan_data_type: "Code39",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify employee discount has been applied",
        expected: {
          voucherCd: COUPON.EMPLOYEE_DISCOUNT.CD,
          voucherGroupCd: COUPON.EMPLOYEE_DISCOUNT.GROUP_CD,
          voucherGroupName: COUPON.EMPLOYEE_DISCOUNT.NAME,
        },
        actual: (res) => {
          const cartinfo = res.result?.cartinfo;
          const payment = cartinfo?.payments?.[0];
          return {
            voucherCd: payment?.voucher_cd,
            voucherGroupCd: payment?.voucher_group_cd,
            voucherGroupName: payment?.voucher_group_name,
          };
        },
      }),
    ]);
    // 5.社割許可商品(上位参照)スキャン /sales/cart/barcode
    TestHelper.salesCartBarcode(step.barcodeEmployeeDiscountReferUpper, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.EMPLOYEE_DISCOUNT_REFER_UPPER,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
    ]);
    // 6.株主優待割許可商品(対象)スキャン /sales/cart/barcode
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
    // 7.株主優待割許可商品(対象外)スキャン /sales/cart/barcode
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
    // 8.株主優待割許可商品(上位参照)スキャン /sales/cart/barcode
    TestHelper.salesCartBarcode(step.barcodeShareholderDiscountReferUpper, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.SHAREHOLDER_DISCOUNT_REFER_UPPER,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
    ]);
    // 9.株主優待バーコードスキャン
    const cartItems = TestHelper.salesCartBarcode(step.barcodeShareholderBenefits, {
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
        name: "Verify shareholder benefit discount has been applied",
        expected: {
          subtotalDiscountCd: COUPON.SHAREHOLDER_BENEFITS.DISCOUNT_CD,
          subtotalDiscountName: COUPON.SHAREHOLDER_BENEFITS.DISCOUNT_NAME,
          subtotalDiscountRate: COUPON.SHAREHOLDER_BENEFITS.DISCOUNT_RATE,
        },
        actual: (res) => {
          const cartinfo = res.result?.cartinfo;
          const subtotalDiscount = cartinfo?.subtotal_discounts?.[0];
          return {
            subtotalDiscountCd: subtotalDiscount?.subtotal_discount_cd,
            subtotalDiscountName: subtotalDiscount?.subtotal_discount_name,
            subtotalDiscountRate: subtotalDiscount?.subtotal_discount_rate,
          };
        },
      }),
    ]).result?.cartinfo?.items;

    const employeeDiscountAllowedIdx = cartItems?.findIndex(q => q.barcode === PROD.EMPLOYEE_DISCOUNT_ALLOWED);
    const employeeDiscountExcludeIdx = cartItems?.findIndex(q => q.barcode === PROD.EMPLOYEE_DISCOUNT_EXCLUDE);
    const employeeDiscountReferUpperIdx = cartItems?.findIndex(q => q.barcode === PROD.EMPLOYEE_DISCOUNT_REFER_UPPER);
    const shareholderDiscountAllowedIdx = cartItems?.findIndex(q => q.barcode === PROD.SHAREHOLDER_DISCOUNT_ALLOWED);
    const shareholderDiscountExcludeIdx = cartItems?.findIndex(q => q.barcode === PROD.SHAREHOLDER_DISCOUNT_EXCLUDE);
    const shareholderDiscountReferUpperIdx = cartItems?.findIndex(q => q.barcode === PROD.SHAREHOLDER_DISCOUNT_REFER_UPPER);

    // 10.小計 /sales/subtotal
    TestHelper.salesSubtotal(step.subtotal, cartNo, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify shareholder benefit discount only applies to 社割許可商品(対象), 社割許可商品(上位参照), 株主優待割許可商品(対象) and 株主優待割許可商品(上位参照), not to 社割許可商品(対象外) and 株主優待割許可商品(対象外)",
        expected: {
          targetItems: JSON.stringify([
            employeeDiscountAllowedIdx,
            employeeDiscountReferUpperIdx,
            shareholderDiscountAllowedIdx,
            shareholderDiscountReferUpperIdx,
          ]),
          nonTargetItems: JSON.stringify([
            employeeDiscountExcludeIdx,
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
          const targetItems = [
            items?.[employeeDiscountAllowedIdx],
            items?.[employeeDiscountReferUpperIdx],
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
      CHECK.createEqualsCheck({
        name: "Verify the employee discount amount",
        expected: (res) => {
          const items = res.result?.cartinfo?.items;
          const targetItems = [
            items?.[employeeDiscountAllowedIdx],
            items?.[employeeDiscountReferUpperIdx],
            items?.[shareholderDiscountAllowedIdx],
            items?.[shareholderDiscountReferUpperIdx],
          ];
          // Total shareholder benefit discount amount
          const shareholderBenefitDiscount = Formular.calcShareHolderBenefitDiscountAmount({
            items: targetItems,
            discountRate: COUPON.SHAREHOLDER_BENEFITS.DISCOUNT_RATE,
            roundMethodType: shareholderRoundingMethod,
          });
          // Redistribute item prices
          const redistributeItems = Formular.redistributeItemsDiscountAmount({
            items: targetItems,
            discountAmount: shareholderBenefitDiscount,
          });
          // Total employee discount amount
          return Formular.calcEmployeeDiscountAmount({
            items: redistributeItems,
            discountRate: COUPON.EMPLOYEE_DISCOUNT.DISCOUNT_RATE,
            roundMethodType: employeeRoundingMethod,
          });
        },
        actual: (res) => res.result?.cartinfo?.payments?.[0]?.paid_amount,
      }),
    ]);
  });
}

/**
 * @function 有人POSの社割・株主優待の併用
 * @memberof 売上.販売促進（企画販売）
 * @description
 * {@link TAGS.POS}
 * {@link TAGS.SALES}
 * {@link TAGS.SALES_PROMOTION_PLANNED_SALES}
 * {@link TAGS.COMPANY_DISCOUNT}
 * {@link TAGS.SHAREHOLDER_BENEFITS}
 * ### テスト観点
 * * 前提：
 * * * ・社員割引バーコードがm_voucherに設定されている。
 * * * ・株主優待バーコードがm_couponに設定されている。
 * * * ・社割許可商品(対象)：m_store_item.allow_employee_discount_type= 1（対象）
 * * * ・社割許可商品(対象外)：m_store_item.allow_employee_discount_type= 2（非対象）
 * * * ・社割許可商品(上位参照)：m_store_item.allow_employee_discount_type= 9（上位参照）
 * * * * 　  かつ、m_item_category.allow_employee_discount_type= 1（対象）
 * * * ・株主優待割許可商品(対象)：m_store_item.allow_shareholder_benefit_type= 1（対象）
 * * * ・株主優待割許可商品(対象外)：m_store_item.allow_shareholder_benefit_type= 2（非対象）
 * * * ・株主優待割許可商品(上位参照)：m_store_item.allow_shareholder_benefit_type= 9（上位参照）
 * * * * 　  かつ、m_item_category.allow_shareholder_benefit_type= 1（対象）
 * * テスト観点：
 * * 商品登録画面で社員割引と株主優待のバーコードをスキャンし社員割引と株主優待の両方が反映される。
 * * * ・小計に社員割引と株主優待の金額が表示される。
 * * * ・割引は株主優待→社員割引の優先順位で割引される。
 * * * ・商品Bと商品Eは割引されない
 * 
 * ---
 * ### テスト方法/シナリオ
 * | Step | 手順 | エンドポイント |
 * | :-: | :--- | :--- |
 * | 1 | 取引開始 | `/sales/begin` |
 * | 2 | 社割許可商品(対象)スキャン | `/sales/cart/barcode` |
 * | 3 | 社割許可商品(対象外)スキャン | `/sales/cart/barcode` |
 * | 4 | 社割許可商品(上位参照)スキャン | `/sales/cart/barcode` |
 * | 5 | 株主優待割許可商品(対象)スキャン | `/sales/cart/barcode` |
 * | 6 | 株主優待割許可商品(対象外)スキャン | `/sales/cart/barcode` |
 * | 7 | 株主優待割許可商品(上位参照)スキャン | `/sales/cart/barcode` |
 * | 8 | 株主優待バーコードスキャン | - |
 * | 9 | 社員割引バーコードスキャン | - |
 * | 10 | 小計 | `/sales/subtotal` |
 * 
 * ---
 * ### 前提条件
 * * 特になし
 * 
 * ---
 * ### テストデータ
 * * 1. 社割許可商品(対象): 4931290077006
 * * 2. 社割許可商品(対象外): 2016020000003
 * * 3. 社割許可商品(上位参照): 0017800174527
 * * 4. 株主優待割許可商品(対象): 4931290077013
 * * 5. 株主優待割許可商品(対象外): 2016020000010
 * * 6. 株主優待割許可商品(上位参照): 0019014614035
 * * 7. 社員割引券: S01000020W
 * * 8. 株主優待: K20180900
 * 
 * ---
 * ### 期待結果
 * * 8.株主優待バーコードスキャン
 * * \- 株主優待割引が適用されていることを確認
 * * * \+ subtotal_discount_cd: 2004
 * * * \+ subtotal_discount_name: 株主優待
 * * * \+ subtotal_discount_rate: 5
 * * 9.社員割引バーコードスキャン
 * * \- 社員割引が適用されていることを確認
 * * * \+ voucher_cd: S01000020W
 * * * \+ voucher_group_cd: 0609
 * * * \+ voucher_group_name: 社員割引券
 * * #### 10.小計 `/sales/subtotal`
 * * \- 株主優待割引の検証は、社割許可商品(対象)、社割許可商品(上位参照)、株主優待割許可商品(対象)、株主優待割許可商品(上位参照)にのみ適用され、社割許可商品(対象外)、株主優待割許可商品(対象外)には適用されないことを確認
 * * * \+ subtotal_discounts.target_items に 社割許可商品(対象)、社割許可商品(上位参照)、株主優待割許可商品(対象)、株主優待割許可商品(上位参照) が含まれること
 * * * \+ subtotal_discounts.non_target_items に 社割許可商品(対象外)、株主優待割許可商品(対象外) が含まれること
 * * \- 株主優待割引金額が233であることを確認
 * * * \+ 株主優待割引金額 = 株主優待割引対象商品の合計金額 × (クーポンマスタ.割引率 ÷ 100)
 * * * \+ 株主優待割引金額 = (社割許可商品(対象) + 社割許可商品(上位参照) + 株主優待割許可商品(対象) + 株主優待割許可商品(上位参照)) x 5 ÷ 100 = (198 + 298 + 198 + 3980) x 5 ÷ 100 = 4674 x 5 ÷ 100 = 233.7
 * * * \+ SubtotalDiscountRoundingMethodType は切り捨て、SubtotalDiscountRoundingDigitType は小数第1位のため、株主優待割引金額は233となる
 * * \- 社員割引金額が223であることを確認（社割許可商品(対象)、社割許可商品(上位参照)、株主優待割許可商品(対象)、株主優待割許可商品(上位参照)が割引され、社割許可商品(対象外)、株主優待割許可商品(対象外)は割引されない）
 * * * \+ アイテムの小計割引按分額 = 株主優待割引小計割引額 × アイテム単価 ÷ 小計割引対象合計金額
 * * * * \. SubtotalDiscountRoundingMethodType は切り捨て、SubtotalDiscountRoundingDigitType は小数第1位
 * * * * \. 小計割引按分額(社割許可商品(対象)) = 233 * 198 ÷ 4674 = 9
 * * * * \. 小計割引按分額(社割許可商品(上位参照)) = 233 * 298 ÷ 4674 = 14
 * * * * \. 小計割引按分額(株主優待割許可商品(対象)) = 233 * 198 ÷ 4674 = 9
 * * * * \. 小計割引按分額(株主優待割許可商品(上位参照)) = 233 * 3980 ÷ 4674 = 198
 * * * \+ 小計割引の端数 = 小計割引額 - アイテムの小計割引按分額合計 = 233-(9+14+9+198) = 3
 * * * \+ 小計割引の余りは3円であり、小計割引対象商品が3つあるため、端数配分優先順位（株主優待割許可商品(上位参照)、社割許可商品(上位参照)、社割許可商品(対象)）に従って配分
 * * * * \. 株主優待割引額(社割許可商品(対象)) = 9 + 1 = 10
 * * * * \. 株主優待割引額(社割許可商品(上位参照)) = 14 + 1 = 15
 * * * * \. 株主優待割引額(株主優待割許可商品(対象)) = 9 + 0 = 9
 * * * * \. 株主優待割引額(株主優待割許可商品(上位参照)) = 198 + 1 = 199
 * * * \+ 社員割引金額 = 株主優待割引後の商品合計金額 × (バウチャーマスタ.割引率 ÷ 100)
 * * * * \. (単価(社割許可商品(対象)) - 株主優待割引額(社割許可商品(対象))) + (単価(社割許可商品(上位参照)) - 株主優待割引額(社割許可商品(上位参照))) + (単価(株主優待割許可商品(対象)) - 株主優待割引額(株主優待割許可商品(対象))) + (単価(株主優待割許可商品(上位参照)) - 株主優待割引額(株主優待割許可商品(上位参照))) = (198 -10 + 298 - 15 + 198 - 9 + 3980 - 199) x 5 ÷ 100 = 222.05
 * * * * \. バウチャーマスタ.RoundingMethod のタイプ は切り上げのため、社員割引金額は223となる
 */
export function TC_011952008_ApplyEmployeeAndShareholderDiscountsManual() {
  group("TC_011952008 有人POSの社割・株主優待の併用", () => {
    const step = {
      begin: CommonFunction.getFullDesc(ENDPOINT.SALES_BEGIN),
      barcodeEmployeeDiscountAllowed: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "社割許可商品(対象)スキャン"),
      barcodeEmployeeDiscountExclude: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "社割許可商品(対象外)スキャン"),
      barcodeEmployeeDiscountReferUpper: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "社割許可商品(上位参照)スキャン"),
      barcodeShareholderDiscountAllowed: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "株主優待割許可商品(対象)スキャン"),
      barcodeShareholderDiscountExclude: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "株主優待割許可商品(対象外)スキャン"),
      barcodeShareholderDiscountReferUpper: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "株主優待割許可商品(上位参照)スキャン"),
      barcodeShareholderBenefits: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "株主優待バーコードスキャン"),
      barcodeEmployeeDiscount: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "社員割引バーコードスキャン"),
      subtotal: CommonFunction.getFullDesc(ENDPOINT.SALES_SUBTOTAL),
    };

    const employeeRoundingMethod = 1; // Specified in master, RoundingMethod Type is rounding up
    const shareholderRoundingMethod = 2; // Specified in master, RoundingMethod Type is rounding down

    // 1.取引開始 /sales/begin
    const cartNo = TestHelper.salesBegin(step.begin, {
      operateEmployeeCd: ENVIRONMENT.EMPLOYEE_CD,
      isSelf: false,
      terminalId: ENVIRONMENT.TERMINAL_ID,
    }, [
      CHECK.createStatusCodeCheck(),
    ]);
    // 2.社割許可商品(対象)スキャン /sales/cart/barcode
    TestHelper.salesCartBarcode(step.barcodeEmployeeDiscountAllowed, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.EMPLOYEE_DISCOUNT_ALLOWED,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
    ]);
    // 3.社割許可商品(対象外)スキャン /sales/cart/barcode
    TestHelper.salesCartBarcode(step.barcodeEmployeeDiscountExclude, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.EMPLOYEE_DISCOUNT_EXCLUDE,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
    ]);
    // 4.社割許可商品(上位参照)スキャン /sales/cart/barcode
    TestHelper.salesCartBarcode(step.barcodeEmployeeDiscountReferUpper, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.EMPLOYEE_DISCOUNT_REFER_UPPER,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
    ]);
    // 5.株主優待割許可商品(対象)スキャン /sales/cart/barcode
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
    // 6.株主優待割許可商品(対象外)スキャン /sales/cart/barcode
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
    // 7.株主優待割許可商品(上位参照)スキャン /sales/cart/barcode
    TestHelper.salesCartBarcode(step.barcodeShareholderDiscountReferUpper, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.SHAREHOLDER_DISCOUNT_REFER_UPPER,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
    ]);
    // 8.株主優待バーコードスキャン
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
        name: "Verify shareholder benefit discount has been applied",
        expected: {
          subtotalDiscountCd: COUPON.SHAREHOLDER_BENEFITS.DISCOUNT_CD,
          subtotalDiscountName: COUPON.SHAREHOLDER_BENEFITS.DISCOUNT_NAME,
          subtotalDiscountRate: COUPON.SHAREHOLDER_BENEFITS.DISCOUNT_RATE,
        },
        actual: (res) => {
          const cartinfo = res.result?.cartinfo;
          const subtotalDiscount = cartinfo?.subtotal_discounts?.[0];
          return {
            subtotalDiscountCd: subtotalDiscount?.subtotal_discount_cd,
            subtotalDiscountName: subtotalDiscount?.subtotal_discount_name,
            subtotalDiscountRate: subtotalDiscount?.subtotal_discount_rate,
          };
        },
      }),
    ]);
    // 9.社員割引バーコードスキャン
    const cartItems = TestHelper.salesCartBarcode(step.barcodeEmployeeDiscount, {
      cartNo,
      barcodes: [
        {
          barcode: COUPON.EMPLOYEE_DISCOUNT.CD,
          scan_data_type: "Code39",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify employee discount has been applied",
        expected: {
          voucherCd: COUPON.EMPLOYEE_DISCOUNT.CD,
          voucherGroupCd: COUPON.EMPLOYEE_DISCOUNT.GROUP_CD,
          voucherGroupName: COUPON.EMPLOYEE_DISCOUNT.NAME,
        },
        actual: (res) => {
          const cartinfo = res.result?.cartinfo;
          const payment = cartinfo?.payments?.[0];
          return {
            voucherCd: payment?.voucher_cd,
            voucherGroupCd: payment?.voucher_group_cd,
            voucherGroupName: payment?.voucher_group_name,
          };
        },
      }),
    ]).result?.cartinfo?.items;

    const employeeDiscountAllowedIdx = cartItems?.findIndex(q => q.barcode === PROD.EMPLOYEE_DISCOUNT_ALLOWED);
    const employeeDiscountExcludeIdx = cartItems?.findIndex(q => q.barcode === PROD.EMPLOYEE_DISCOUNT_EXCLUDE);
    const employeeDiscountReferUpperIdx = cartItems?.findIndex(q => q.barcode === PROD.EMPLOYEE_DISCOUNT_REFER_UPPER);
    const shareholderDiscountAllowedIdx = cartItems?.findIndex(q => q.barcode === PROD.SHAREHOLDER_DISCOUNT_ALLOWED);
    const shareholderDiscountExcludeIdx = cartItems?.findIndex(q => q.barcode === PROD.SHAREHOLDER_DISCOUNT_EXCLUDE);
    const shareholderDiscountReferUpperIdx = cartItems?.findIndex(q => q.barcode === PROD.SHAREHOLDER_DISCOUNT_REFER_UPPER);

    // 10.小計 /sales/subtotal
    TestHelper.salesSubtotal(step.subtotal, cartNo, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify shareholder benefit discount only applies to 社割許可商品(対象), 社割許可商品(上位参照), 株主優待割許可商品(対象) and 株主優待割許可商品(上位参照), not to 社割許可商品(対象外) and 株主優待割許可商品(対象外)",
        expected: {
          targetItems: JSON.stringify([
            employeeDiscountAllowedIdx,
            employeeDiscountReferUpperIdx,
            shareholderDiscountAllowedIdx,
            shareholderDiscountReferUpperIdx,
          ]),
          nonTargetItems: JSON.stringify([
            employeeDiscountExcludeIdx,
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
          const targetItems = [
            items?.[employeeDiscountAllowedIdx],
            items?.[employeeDiscountReferUpperIdx],
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
      CHECK.createEqualsCheck({
        name: "Verify the employee discount amount",
        expected: (res) => {
          const items = res.result?.cartinfo?.items;
          const targetItems = [
            items?.[employeeDiscountAllowedIdx],
            items?.[employeeDiscountReferUpperIdx],
            items?.[shareholderDiscountAllowedIdx],
            items?.[shareholderDiscountReferUpperIdx],
          ];
          // Total shareholder benefit discount amount
          const shareholderBenefitDiscount = Formular.calcShareHolderBenefitDiscountAmount({
            items: targetItems,
            discountRate: COUPON.SHAREHOLDER_BENEFITS.DISCOUNT_RATE,
            roundMethodType: shareholderRoundingMethod,
          });
          // Redistribute item prices
          const redistributeItems = Formular.redistributeItemsDiscountAmount({
            items: targetItems,
            discountAmount: shareholderBenefitDiscount,
          });
          // Total employee discount amount
          return Formular.calcEmployeeDiscountAmount({
            items: redistributeItems,
            discountRate: COUPON.EMPLOYEE_DISCOUNT.DISCOUNT_RATE,
            roundMethodType: employeeRoundingMethod,
          });
        },
        actual: (res) => res.result?.cartinfo?.payments?.[0]?.paid_amount,
      }),
    ]);
  });
}

/**
 * @function セルフPOSの社員割引（異常系：有効期限ではない）
 * @memberof 売上.販売促進（企画販売）
 * @description
 * {@link TAGS.POS}
 * {@link TAGS.SALES}
 * {@link TAGS.SALES_PROMOTION_PLANNED_SALES}
 * {@link TAGS.COMPANY_DISCOUNT}
 * {@link TAGS.EXPIRY_DATE_CHECK}
 * ### テスト観点
 * * 商品登録画面で社員割引バーコードをスキャンし有効期限エラーとなる。
 * * * → 社員割引バーコードは金券マスタに社員割引レコードが存在し、
 * * * 有効期限が範囲外のもの。
 * * 有効期限エラー：
 * * * ・エラーメッセージ：この金券は現在利用できません（利用期間終了）
 * * * ・エラーコード：VUC0003
 * 
 * ---
 * ### テスト方法/シナリオ
 * | Step | 手順 | エンドポイント |
 * | :-: | :--- | :--- |
 * | 1 | 取引開始 | `/sales/begin` |
 * | 2 | 社員割引バーコードスキャン　→　エラー終了 | - |
 * 
 * ---
 * ### 前提条件
 * * 特になし
 * 
 * ---
 * ### テストデータ
 * * 1. 社員割引券（利用期間外）: S20231101W
 * 
 * ---
 * ### 期待結果
 * * 2.社員割引バーコードスキャン　→　エラー終了
 * * \- ステータスコード: 220
 * * \- エラーメッセージ: "この金券は現在利用できません（利用期間終了）"
 * * \- エラーコード: "VUC0003"
 */
export function TC_011952002_CheckSelfPOSDiscountForEmployee_Abnormal_Expired() {
  group("TC_011952002 セルフPOSの社員割引（異常系：有効期限ではない）", () => {
    const step = {
      begin: CommonFunction.getFullDesc(ENDPOINT.SALES_BEGIN),
      barcodeExpiredEmployeeDiscount: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "社員割引バーコードスキャン → エラー終了"),
    };

    const cartNo = TestHelper.salesBegin(step.begin, {}, [
      CHECK.createStatusCodeCheck(),
    ]);

    TestHelper.salesCartBarcode(step.barcodeExpiredEmployeeDiscount, {
      cartNo,
      barcodes: [
        {
          barcode: COUPON.EXPIRED_EMPLOYEE_DISCOUNT.CD,
          scan_data_type: "Code39",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(220),
      CHECK.createErrorCheck("VUC0003", "この金券は現在利用できません（利用期間終了）"),
    ]);
  });
}

/**
 * @function セルフPOSの社員割引（異常系：利用可能枚数超過）
 * @memberof 売上.販売促進（企画販売）
 * @description
 * {@link TAGS.POS}
 * {@link TAGS.SALES}
 * {@link TAGS.SALES_PROMOTION_PLANNED_SALES}
 * {@link TAGS.COMPANY_DISCOUNT}
 * ### テスト観点
 * * 商品登録画面で社員割引バーコードをスキャンし利用可能枚数超過エラーとなる。
 * * * → 社員割引バーコードは金券マスタに社員割引レコードが存在し、
 * * * 利用可能枚数が１のもの。
 * * * → 商品A：商品マスタの社員割引許可区分が１（対象）-> 社割許可商品(対象)
 * * * 商品B：商品マスタの社員割引許可区分が２（非対象）-> 社割許可商品(対象外)
 * * 前提：
 * * * ・社員割引バーコードがm_voucherに設定されている。
 * * * かつ、m_voucher.voucher_available_count=１
 * * * ・商品A：m_store_item.allow_employee_discount_type= 1（対象）
 * * * ・商品B：m_store_item.allow_employee_discount_type= 2（非対象）
 * * テスト観点：
 * * 社員割引バーコードが利用可能枚数超過の場合にエラーになる。
 * * エラーメッセージ：
 * * \- エラーメッセージ: "ご利用の金券が利用可能枚数を超えています",
 * * \- エラーコード: "PAY0015",
 * 
 * ---
 * ### テスト方法/シナリオ
 * | Step | 手順 | エンドポイント |
 * | :-: | :--- | :--- |
 * | 1 | 取引開始 | `/sales/begin` |
 * | 2 | 社割許可商品(対象)スキャン | `/sales/cart/barcode` |
 * | 3 | 社割許可商品(対象外)スキャン | `/sales/cart/barcode` |
 * | 4 | 社員割引バーコードスキャン (１回目) | - |
 * | 5 | 社員割引バーコードスキャン(２回目)　→　エラー終了 | - |
 * 
 * ---
 * ### 前提条件
 * * 特になし
 * 
 * ---
 * ### テストデータ
 * * 1.社割許可商品(対象): 4931290077006
 * * 2.社割許可商品(対象外): 2016020000003
 * * 3.社員割引券（利用可能枚数が1）: S01000021W
 * 
 * ---
 * ### 期待結果
 * * #### 2.社割許可商品(対象)スキャン `/sales/cart/barcode`
 * * Cart Info に 社割許可商品(対象)があるか確認
 * * * \+ barcode : 4931290077006
 * * #### 3.社割許可商品(対象外)スキャン `/sales/cart/barcode`
 * * Cart Info に 社割許可商品(対象外)があるか確認
 * * * \+ barcode : 2016020000003
 * * 4.社員割引バーコードスキャン (１回目)
 * * 社割が適用されたか確認
 * * * \+ voucher_cd: S01000021W
 * * * \+ voucher_group_cd: 0609
 * * * \+ voucher_group_name: 社員割引券
 * * 5.社員割引バーコードスキャン(２回目)　→　エラー終了
 * * \- ステータスコード: 220
 * * \- エラーメッセージ: "ご利用の金券が利用可能枚数を超えています",
 * * \- エラーコード: "PAY0015"
 */
export function TC_011952003_CheckSelfPOSDiscountForEmployee_Abnormal_QuantityLimit() {
  group("TC_011952003 セルフPOSの社員割引（異常系：利用可能枚数超過）", () => {
    const step = {
      begin: CommonFunction.getFullDesc(ENDPOINT.SALES_BEGIN),
      barcodeEmployeeDiscountAllowed: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "社割許可商品(対象)スキャン"),
      barcodeEmployeeDiscountExclude: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "社割許可商品(対象外)スキャン"),
      barcodeShareholderBenefitSingleUserFirst: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "社員割引バーコードスキャン(1st)"),
      barcodeShareholderBenefitSingleUserSecond: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "社員割引バーコードスキャン(2nd) → エラー終了"),
    };

    const cartNo = TestHelper.salesBegin(step.begin, {}, [
      CHECK.createStatusCodeCheck(),
    ]);

    TestHelper.salesCartBarcode(step.barcodeEmployeeDiscountAllowed, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.EMPLOYEE_DISCOUNT_ALLOWED,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify the cart info contains 社割許可商品(対象)",
        expected: true,
        actual: (res) => CommonFunction.hasItems([
          PROD.EMPLOYEE_DISCOUNT_ALLOWED,
        ], res.result?.cartinfo?.items),
      }),
    ]);

    TestHelper.salesCartBarcode(step.barcodeEmployeeDiscountExclude, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.EMPLOYEE_DISCOUNT_EXCLUDE,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify the cart info contains 社割許可商品(対象外)",
        expected: true,
        actual: (res) => CommonFunction.hasItems([
          PROD.EMPLOYEE_DISCOUNT_EXCLUDE,
        ], res.result?.cartinfo?.items),
      }),
    ]);

    TestHelper.salesCartBarcode(step.barcodeShareholderBenefitSingleUserFirst, {
      cartNo,
      barcodes: [
        {
          barcode: COUPON.SHAREHOLDER_BENEFIT_SINGLE_USER.CD,
          scan_data_type: "Code39",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify employee discount has been applied",
        expected: {
          voucherCd: COUPON.SHAREHOLDER_BENEFIT_SINGLE_USER.CD,
          voucherGroupCd: COUPON.SHAREHOLDER_BENEFIT_SINGLE_USER.GROUP_CD,
          voucherGroupName: COUPON.SHAREHOLDER_BENEFIT_SINGLE_USER.GROUP_NAME,
        },
        actual: (res) => {
          const cartinfo = res.result?.cartinfo;
          const payment = cartinfo?.payments?.[0];
          return {
            voucherCd: payment?.voucher_cd,
            voucherGroupCd: payment?.voucher_group_cd,
            voucherGroupName: payment?.voucher_group_name,
          };
        },
      }),
    ]);

    TestHelper.salesCartBarcode(step.barcodeShareholderBenefitSingleUserSecond, {
      cartNo,
      barcodes: [
        {
          barcode: COUPON.SHAREHOLDER_BENEFIT_SINGLE_USER.CD,
          scan_data_type: "Code39",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(220),
      CHECK.createErrorCheck("PAY0015", "ご利用の金券が利用可能枚数を超えています"),
    ]);
  });
}

/**
 * @function 有人POSの社員割引（異常系：利用可能枚数超過）
 * @memberof 売上.販売促進（企画販売）
 * @description
 * {@link TAGS.POS}
 * {@link TAGS.SALES}
 * {@link TAGS.SALES_PROMOTION_PLANNED_SALES}
 * {@link TAGS.COMPANY_DISCOUNT}
 * ### テスト観点
 * * 小計操作後に社員割引バーコードをスキャンし利用可能枚数超過エラーとなる。
 * * * → 社員割引バーコードは金券マスタに社員割引レコードが存在し、
 * * * 利用可能枚数が1のもの。
 * * * → 社割許可商品(対象)：商品マスタの社員割引許可区分が１（対象）
 * * * 社割許可商品(対象外)：商品マスタの社員割引許可区分が２（非対象）
 * * 前提：
 * * * ・社員割引バーコードがm_voucherに設定されている。
 * * * かつ、m_voucher.voucher_available_count=１
 * * * ・社割許可商品(対象)：m_store_item.allow_employee_discount_type= 1（対象）
 * * * ・社割許可商品(対象外)：m_store_item.allow_employee_discount_type= 2（非対象）
 * * テスト観点：
 * * 社員割引バーコードが利用可能枚数超過の場合にエラーになる。
 * * \- エラーメッセージ: "ご利用の金券が利用可能枚数を超えています"
 * * \- エラーコード: "PAY0015"
 * 
 * ---
 * ### テスト方法/シナリオ
 * | Step | 手順 | エンドポイント |
 * | :-: | :--- | :--- |
 * | 1 | 取引開始 | `/sales/begin` |
 * | 2 | 社割許可商品(対象)スキャン | `/sales/cart/barcode` |
 * | 3 | 社割許可商品(対象外)スキャン | `/sales/cart/barcode` |
 * | 4 | 小計 | `/sales/subtotal` |
 * | 5 | 社員割引バーコードスキャン (１回目) | - |
 * | 6 | 社員割引バーコードスキャン　(２回目) →　エラー終了 | - |
 * 
 * ---
 * ### 前提条件
 * * 特になし
 * 
 * ---
 * ### テストデータ
 * * 1.社割許可商品(対象): 4931290077006
 * * 2.社割許可商品(対象外): 2016020000003
 * * 3.社員割引券（利用可能枚数が1）: S01000021W
 * 
 * ---
 * ### 期待結果
 * * #### 2.社割許可商品(対象)スキャン   `/sales/cart/barcode`
 * * Cart Info に 社割許可商品(対象)があるか確認
 * * * \+ barcode : 4931290077006
 * * #### 3.社割許可商品(対象外)スキャン   `/sales/cart/barcode`
 * * Cart Info に 社割許可商品(対象外)があるか確認
 * * * \+ barcode : 2016020000003
 * * #### 4.小計 `/sales/subtotal`
 * * \- Cart Info に２つのアイテムがあるか確認
 * * \- total_balance_amount は 713 か確認
 * * * \+ 社割許可商品(対象)の税金 = 198x8:100 = 15 (※15.84 round down)
 * * * \+ 社割許可商品(対象外)（税込） = 500
 * * * \+ total_balance_amount = 合計（税込） =  198+15+500 = 713
 * * 5.社員割引バーコードスキャン  (１回目)
 * * \- 社割が適用されたか確認
 * * * \+ voucher_cd: S01000021W
 * * * \+ voucher_group_cd: 0609
 * * * \+ voucher_group_name: 社員割引券
 * * \- 社割額 が 10か確認
 * * * \+ 社割額 = 社割の商品の合計金額 × (Voucher Master.Discount Rate ÷ 100)
 * * * \+ 社割額 = 社割許可商品(対象)  × (Voucher Master.Discount Rate ÷ 100) = 198x5÷100 = 9.9
 * * * \+ Voucher Master.RoundingMethod Type は切り上げ　→　社割額が10
 * * \- total_balance_amount は 703か確認
 * * * \+ total_balance_amount = 合計金額（税込） - 社割額 =  713 - 10 = 703
 * * 6. 社員割引バーコードスキャン (２回目)　→　エラー終了
 * * \- ステータスコード 220
 * * \- エラーメッセージ: "ご利用の金券が利用可能枚数を超えています"
 * * \- エラーコード: "PAY0015"
 */
export function TC_011952006_CheckPosEmployeeDiscount_Abnormal_QuantityLimit() {
  group("TC_011952006 有人POSの社員割引（異常系：利用可能枚数超過）", () => {
    const step = {
      begin: CommonFunction.getFullDesc(ENDPOINT.SALES_BEGIN),
      barcodeEmployeeDiscountAllowed: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "社割許可商品(対象)スキャン"),
      barcodeEmployeeDiscountExclude: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "社割許可商品(対象外)スキャン"),
      subtotal: CommonFunction.getFullDesc(ENDPOINT.SALES_SUBTOTAL),
      barcodeShareholderBenefitSingleUserFirst: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "社員割引バーコードスキャン(1st)"),
      barcodeShareholderBenefitSingleUserSecond: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "社員割引バーコードスキャン(2nd) → エラー終了"),
    };

    let employeeDiscountAmount = 0;
    const employeeRoundingMethod = 1; // Specified in master, RoundingMethod Type is rounding up

    const cartNo = TestHelper.salesBegin(step.begin, {
      operateEmployeeCd: ENVIRONMENT.EMPLOYEE_BARCODE,
      isSelf: false,
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    TestHelper.salesCartBarcode(step.barcodeEmployeeDiscountAllowed, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.EMPLOYEE_DISCOUNT_ALLOWED,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify the cart info contains 社割許可商品(対象)",
        expected: true,
        actual: (res) => CommonFunction.hasItems([
          PROD.EMPLOYEE_DISCOUNT_ALLOWED,
        ], res.result?.cartinfo?.items),
      }),
    ]);

    TestHelper.salesCartBarcode(step.barcodeEmployeeDiscountExclude, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.EMPLOYEE_DISCOUNT_EXCLUDE,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify the cart info contains 社割許可商品(対象外)",
        expected: true,
        actual: (res) => CommonFunction.hasItems([
          PROD.EMPLOYEE_DISCOUNT_EXCLUDE,
        ], res.result?.cartinfo?.items),
      }),
    ]);

    const cartItems = TestHelper.salesSubtotal(step.subtotal, cartNo, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify the cart has 2 items",
        expected: true,
        actual: (res) => CommonFunction.hasItems([
          PROD.EMPLOYEE_DISCOUNT_ALLOWED,
          PROD.EMPLOYEE_DISCOUNT_EXCLUDE,
        ], res.result?.cartinfo?.items),
      }),
      CHECK.createEqualsCheck({
        name: "Verify total_balance_amount",
        expected: (res) => Formular.calcTotalBalanceAmount(res.result?.cartinfo?.items),
        actual: (res) => res.result?.cartinfo?.total_balance_amount,
      }),
    ]).result?.cartinfo?.items;

    // 社割許可商品(対象)
    const targetItems = cartItems.filter(i => i.barcode === PROD.EMPLOYEE_DISCOUNT_ALLOWED);

    TestHelper.salesCartBarcode(step.barcodeShareholderBenefitSingleUserFirst, {
      cartNo,
      barcodes: [
        {
          barcode: COUPON.SHAREHOLDER_BENEFIT_SINGLE_USER.CD,
          scan_data_type: "Code39",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify employee discount has been applied",
        expected: {
          voucherCd: COUPON.SHAREHOLDER_BENEFIT_SINGLE_USER.CD,
          voucherGroupCd: COUPON.SHAREHOLDER_BENEFIT_SINGLE_USER.GROUP_CD,
          voucherGroupName: COUPON.SHAREHOLDER_BENEFIT_SINGLE_USER.GROUP_NAME,
        },
        actual: (res) => {
          const cartinfo = res.result?.cartinfo;
          const payment = cartinfo?.payments?.[0];
          return {
            voucherCd: payment?.voucher_cd,
            voucherGroupCd: payment?.voucher_group_cd,
            voucherGroupName: payment?.voucher_group_name,
          };
        },
      }),
      CHECK.createEqualsCheck({
        name: "Verify the employee discount amount",
        expected: () => {
          employeeDiscountAmount = Formular.calcEmployeeDiscountAmount({
            items: targetItems,
            discountRate: COUPON.SHAREHOLDER_BENEFIT_SINGLE_USER.DISCOUNT_RATE,
            roundMethodType: employeeRoundingMethod,
          });
          return employeeDiscountAmount;
        },
        actual: (res) => res.result?.cartinfo?.payments?.[0]?.paid_amount,
      }),
      CHECK.createEqualsCheck({
        name: "Verify total_balance_amount",
        expected: (res) => Formular.calcTotalBalanceAmount(res.result?.cartinfo?.items, employeeDiscountAmount),
        actual: (res) => res.result?.cartinfo?.total_balance_amount,
      }),
    ]);

    TestHelper.salesCartBarcode(step.barcodeShareholderBenefitSingleUserSecond, {
      cartNo,
      barcodes: [
        {
          barcode: COUPON.SHAREHOLDER_BENEFIT_SINGLE_USER.CD,
          scan_data_type: "Code39",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(220),
      CHECK.createErrorCheck("PAY0015", "ご利用の金券が利用可能枚数を超えています"),
    ]);
  });
}
